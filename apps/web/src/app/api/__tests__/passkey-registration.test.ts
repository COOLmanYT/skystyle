import { POST as register } from '../passkeys/register/route';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { NextRequest } from 'next/server';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('@/lib/sync-user', () => ({ syncPublicUser: jest.fn() }));
jest.mock('@/lib/security', () => ({ logSecurityEvent: jest.fn() }));
jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(),
  verifyRegistrationResponse: async () => ({ verified: true, registrationInfo: { credentialID: new Uint8Array([1]), credentialPublicKey: new Uint8Array([2]), counter: 0 } }),
}));
let failed = false;
const mutations: string[] = [];
beforeEach(() => {
  failed = false; mutations.length = 0;
  (auth as jest.Mock).mockResolvedValue({ user: { id: 'synthetic', email: 'test@example.invalid' } });
  (supabaseAdmin.from as jest.Mock).mockImplementation(() => {
    const query = {
      select: () => query, eq: () => query,
      single: async () => ({ data: { browser: 'challenge' }, error: null }),
      insert: () => { mutations.push('credential insert'); return query; },
      delete: () => { mutations.push('challenge delete'); return query; },
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error: failed ? { message: 'synthetic outage' } : null }).then(resolve),
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
  const response = await register({ json: async () => ({ response: {} }), headers: new Headers() } as unknown as NextRequest);
  expect(response.status).toBe(200);
  expect(mutations).toEqual(['credential insert', 'challenge delete']);
});
