import { z } from 'zod';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { validateCertificatePath } from '@simplewebauthn/server/helpers';
import { X509CertificateGenerator } from '@peculiar/x509';
import { startRegistration } from '@simplewebauthn/browser';

test.each(['array', 'set', 'map'] as const)('oversized %s rejects before parsing its elements', (kind) => {
  const visit = jest.fn((value: unknown) => value);
  const item = z.unknown().transform(visit);
  const schema = kind === 'array' ? z.array(item).max(2)
    : kind === 'set' ? z.set(item).max(2) : z.map(z.number(), item).max(2);
  const values = Array.from({ length: 256 }, (_, i) => i);
  const oversized = kind === 'array' ? values : kind === 'set' ? new Set(values) : new Map(values.map(value => [value, value]));
  const result = schema.safeParse(oversized);
  expect(result.success).toBe(false);
  expect(visit).not.toHaveBeenCalled();
  const valid = kind === 'array' ? [1, 2] : kind === 'set' ? new Set([1, 2]) : new Map([[1, 1], [2, 2]]);
  expect(schema.safeParse(valid).success).toBe(true);
  expect(visit).toHaveBeenCalledTimes(2);
});

test('the actual passkey library generates browser-compatible registration options', async () => {
  const result = await generateRegistrationOptions({
    rpName: 'Sky Style', rpID: 'localhost', userName: 'synthetic@example.invalid',
    userID: new TextEncoder().encode('synthetic'), attestationType: 'none',
    excludeCredentials: [{ id: 'AQ-_', transports: ['internal'] }],
  });
  expect(result.user.id).toBe(Buffer.from('synthetic').toString('base64url'));
  expect(result.challenge).toEqual(expect.any(String));
  expect(result.excludeCredentials).toEqual([{ id: 'AQ-_', type: 'public-key', transports: ['internal'] }]);
});

test.each(['12345678-1234-1234-1234-123456789012', 'a'.repeat(64), 'é'.repeat(32)])('browser and server preserve user handle %s', async (userId) => {
  const options = await generateRegistrationOptions({
    rpName: 'Sky Style', rpID: 'localhost', userName: 'synthetic@example.invalid',
    userID: new TextEncoder().encode(userId), attestationType: 'none',
    excludeCredentials: [{ id: 'AQ-_', transports: ['internal'] }],
  });
  const create = jest.fn(async () => ({
    id: 'AQ-_', rawId: new Uint8Array([1, 15, 191]).buffer, type: 'public-key',
    response: { attestationObject: new ArrayBuffer(1), clientDataJSON: new ArrayBuffer(1), getTransports: () => ['internal'] },
    getClientExtensionResults: () => ({}), authenticatorAttachment: 'platform',
  }));
  const descriptors = ['PublicKeyCredential', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.defineProperty(globalThis, 'PublicKeyCredential', { configurable: true, value: function PublicKeyCredential() {} });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { credentials: { create } } });
  try {
    const response = await startRegistration({ optionsJSON: options });
    const supplied = (create.mock.calls as unknown as [[CredentialCreationOptions]])[0][0].publicKey!;
    expect(Buffer.from(supplied.user.id as ArrayBuffer)).toEqual(Buffer.from(userId));
    expect(Buffer.from(supplied.user.id as ArrayBuffer).length).toBeLessThanOrEqual(64);
    expect(Buffer.from(supplied.excludeCredentials![0].id as ArrayBuffer).toString('base64url')).toBe('AQ-_');
    expect(response.id).toBe('AQ-_');
    expect(response.response.transports).toEqual(['internal']);
  } finally {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('attestation chains must terminate at the configured trust anchor', async () => {
  // Synthetic, non-exportable keys exist only in memory. No external PKI or network.
  const crypto = globalThis.crypto;
  const algorithm = { name: 'ECDSA', namedCurve: 'P-256' };
  const signingAlgorithm = { name: 'ECDSA', hash: 'SHA-256' };
  const validity = { notBefore: new Date(Date.now() - 60_000), notAfter: new Date(Date.now() + 60_000) };
  const makeRoot = async (name: string) => {
    const keys = await crypto.subtle.generateKey(algorithm, false, ['sign', 'verify']);
    const cert = await X509CertificateGenerator.createSelfSigned({ name, keys, signingAlgorithm, ...validity, serialNumber: '01' }, crypto);
    return { keys, cert };
  };
  const trusted = await makeRoot('CN=Synthetic trusted root');
  const attacker = await makeRoot('CN=Synthetic untrusted root');
  const leafKeys = await crypto.subtle.generateKey(algorithm, false, ['sign', 'verify']);
  const makeLeaf = (root: typeof trusted) => X509CertificateGenerator.create({
    issuer: root.cert.subject, subject: 'CN=Synthetic leaf', publicKey: leafKeys.publicKey,
    signingKey: root.keys.privateKey, signingAlgorithm, ...validity, serialNumber: '02',
  }, crypto);
  const legitimateLeaf = await makeLeaf(trusted);
  const forgedLeaf = await makeLeaf(attacker);
  const anchor = [trusted.cert.toString('pem')];
  await expect(validateCertificatePath([legitimateLeaf.toString('pem')], anchor)).resolves.toBe(true);
  await expect(validateCertificatePath([forgedLeaf.toString('pem'), attacker.cert.toString('pem')], anchor)).rejects.toThrow();
  await expect(validateCertificatePath([attacker.cert.toString('pem')], anchor)).rejects.toThrow();
});
