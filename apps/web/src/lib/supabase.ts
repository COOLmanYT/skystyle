import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing environment variable: ${name}`);
  return val;
}

function validateSupabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Invalid SUPABASE_URL: must use http or https protocol`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Invalid SUPABASE_URL")) throw e;
    throw new Error(`Invalid SUPABASE_URL: must be a valid HTTP or HTTPS URL`);
  }
  return url;
}

let _admin: SupabaseClient | null = null;

/** Server-side admin client (service role — never expose to client) */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      validateSupabaseUrl(getEnv("SUPABASE_URL")),
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
