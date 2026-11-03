import { GET } from '../privacy/export/route';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { NextRequest } from 'next/server';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('next/server', () => ({ NextResponse: Response }));
jest.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('@/lib/sync-user', () => ({ syncPublicUser: jest.fn() }));
jest.mock('@/lib/security', () => ({ logSecurityEvent: jest.fn() }));
test.each(['users','settings','closet','daily_usage','feedback','security_logs','passkeys','deletion_requests'])('%s database failures must not become a successful incomplete export', async (failedTable) => {
  (auth as jest.Mock).mockResolvedValue({ user: { id: 'synthetic' } });
  (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
    const result = { data: table === 'users' && table !== failedTable ? { id:'synthetic' } : null, error: table === failedTable ? { code: '08006', message: 'synthetic connection failure' } : null };
    const query = { select: () => query, eq: () => query, order: () => query, limit: () => query,
      single: async () => result, maybeSingle: async () => result,
      then: (resolve: (v:unknown) => unknown) => Promise.resolve(result).then(resolve) };
    return query;
  });
  expect((await GET({ headers: new Headers() } as unknown as NextRequest)).status).toBe(503);
});
test('absent optional singleton rows do not block an otherwise complete export', async () => {
  (auth as jest.Mock).mockResolvedValue({ user: { id: 'synthetic' } });
  (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
    const absent = ['settings','closet','deletion_requests'].includes(table);
    const result = { data: table === 'users' ? { id: 'synthetic' } : absent ? null : [], error: null };
    const query = { select: () => query, eq: () => query, order: () => query, limit: () => query,
      single: async () => result, maybeSingle: async () => result,
      then: (resolve: (v:unknown) => unknown) => Promise.resolve(result).then(resolve) };
    return query;
  });
  expect((await GET({ headers: new Headers() } as unknown as NextRequest)).status).toBe(200);
});
test.each(['users','settings','closet','deletion_requests'])('a singleton cardinality error for %s must fail closed', async failedTable => {
  (auth as jest.Mock).mockResolvedValue({ user: { id: 'synthetic' } });
  (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
    const result = { data: table === failedTable ? null : table === 'users' ? { id: 'synthetic' } : [], error: table === failedTable ? { code:'PGRST116', details:'The result contains 2 rows', message:'Cannot coerce to single object' } : null };
    const query = { select: () => query, eq: () => query, order: () => query, limit: () => query,
      single: async () => result, maybeSingle: async () => result,
      then: (resolve: (v:unknown) => unknown) => Promise.resolve(result).then(resolve) };
    return query;
  });
  expect((await GET({ headers: new Headers() } as unknown as NextRequest)).status).toBe(503);
});
test('a missing required profile must not produce an anonymous-looking export', async () => {
  (auth as jest.Mock).mockResolvedValue({ user: { id: 'synthetic' } });
  (supabaseAdmin.from as jest.Mock).mockImplementation(() => {
    const result = { data:null, error:null };
    const query = { select: () => query, eq: () => query, order: () => query, limit: () => query,
      single: async () => result, maybeSingle: async () => result,
      then: (resolve: (v:unknown) => unknown) => Promise.resolve(result).then(resolve) };
    return query;
  });
  expect((await GET({ headers: new Headers() } as unknown as NextRequest)).status).toBe(503);
});
