import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing environment variable: ${name}`);
  return val;
}

let _admin: SupabaseClient | null = null;

/** Server-side admin client (service role — never expose to client) */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );
  }
  return _admin;
}

/** Convenience alias used in API routes */
export const supabaseAdmin = {
  from: (...args: Parameters<SupabaseClient["from"]>) =>
    getSupabaseAdmin().from(...args),
} as unknown as SupabaseClient;
