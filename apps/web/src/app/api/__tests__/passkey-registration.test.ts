import { GET as options, POST as register } from '../passkeys/register/route';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { NextRequest } from 'next/server';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('@/lib/sync-user', () => ({ syncPublicUser: jest.fn() }));
jest.mock('@/lib/security', () => ({ logSecurityEvent: jest.fn() }));
jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
}));
let failed = false;
const mutations: string[] = [];
const insert = jest.fn();
const upsert = jest.fn();
beforeEach(() => {
  failed = false; mutations.length = 0;
  (verifyRegistrationResponse as jest.Mock).mockResolvedValue({ verified: true, registrationInfo: { credential: { id: 'AQ-_', publicKey: new Uint8Array([2, 255]), counter: 3 } } });
  (generateRegistrationOptions as jest.Mock).mockResolvedValue({ challenge: 'fresh-challenge' });
  (auth as jest.Mock).mockResolvedValue({ user: { id: 'synthetic', email: 'test@example.invalid' } });
  (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
    const query = {
      select: () => query, eq: () => query,
      single: async () => ({ data: { browser: 'challenge' }, error: null }),
      insert: (row: unknown) => { insert(row); mutations.push('credential insert'); return query; },
      upsert: (row: unknown, config: unknown) => { upsert(row, config); return query; },
      delete: () => { mutations.push('challenge delete'); return query; },
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: table === 'passkeys' ? [{ credential_id: 'existing-_', transports: 'internal,usb' }] : null, error: failed ? { message: 'synthetic outage' } : null }).then(resolve),
    };
    return query;
  });
});
test('failed credential storage must not report verified registration', async () => {
  failed = true;
  const response = await register({ json: async () => ({ response: {} }), headers: new Headers() } as unknown as NextRequest);
  expect(response.status).toBe(503);
  expect(mutations).not.toContain('challenge delete');
});
test('successful credential storage still completes registration', async () => {
  const response = await register({ json: async () => ({ response: { transports: ['internal'] } }), headers: new Headers() } as unknown as NextRequest);
  expect(response.status).toBe(200);
  expect(mutations).toEqual(['credential insert', 'challenge delete']);
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ credential_id: 'AQ-_', public_key: 'Av8=', counter: 3, transports: 'internal' }));
  expect(verifyRegistrationResponse).toHaveBeenCalledWith(expect.objectContaining({ expectedChallenge: 'challenge', expectedOrigin: 'http://localhost:3000', expectedRPID: 'localhost' }));
});

test('registration options preserve the user handle and existing exclusions', async () => {
  const response = await options();
  expect(response.status).toBe(200);
  expect(generateRegistrationOptions).toHaveBeenCalledWith(expect.objectContaining({
    userID: new TextEncoder().encode('synthetic'),
    attestationType: 'none',
    excludeCredentials: [{ id: 'existing-_', transports: ['internal', 'usb'] }],
  }));
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ browser: 'fresh-challenge' }), { onConflict: 'session_token' });
});

test.each(['throw', 'unverified'])('rejects %s verification without storing a credential', async (failure) => {
  if (failure === 'throw') (verifyRegistrationResponse as jest.Mock).mockRejectedValue(new Error('Untrusted certificate'));
  else (verifyRegistrationResponse as jest.Mock).mockResolvedValue({ verified: false });
  const response = await register({ json: async () => ({ response: {} }), headers: new Headers() } as unknown as NextRequest);
  expect(response.status).toBe(400);
  expect(mutations).toEqual([]);
});
