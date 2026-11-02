jest.mock('next-auth', () => ({ __esModule: true, default: jest.fn(() => ({})) }));
jest.mock('next-auth/providers/github', () => ({ __esModule: true, default: { id: 'github', type: 'oauth' } }));
jest.mock('next-auth/providers/google', () => ({ __esModule: true, default: { id: 'google', type: 'oidc' } }));
jest.mock('next-auth/providers/microsoft-entra-id', () => ({ __esModule: true, default: () => ({ id: 'microsoft-entra-id', type: 'oidc' }) }));
jest.mock('next-auth/providers/apple', () => ({ __esModule: true, default: () => ({ id: 'apple', type: 'oidc' }) }));
jest.mock('next-auth/providers/credentials', () => ({ __esModule: true, default: (config: object) => ({ ...config, type: 'credentials' }) }));
jest.mock('@auth/supabase-adapter', () => ({ SupabaseAdapter: () => ({}) }), { virtual: true });
jest.mock('@/lib/oauth-readiness', () => ({ getOptionalOAuthReadiness: () => ({ microsoft: true, apple: true }) }));

test('OAuth and demo auth do not enable the incompatible optional Auth.js WebAuthn provider', () => {
  jest.isolateModules(() => {
    jest.requireActual('@/auth');
    const nextAuth = jest.requireMock('next-auth').default as jest.Mock;
    const config = nextAuth.mock.calls[0][0];
    expect(config.providers.map((provider: { id: string }) => provider.id)).toEqual(['github', 'google', 'microsoft-entra-id', 'apple', 'demo']);
    expect(config.providers.every((provider: { type: string }) => provider.type !== 'webauthn')).toBe(true);
    expect(config.experimental?.enableWebAuthn).not.toBe(true);
    expect(config.session.strategy).toBe('jwt');
  });
});
