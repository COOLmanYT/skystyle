/**
 * Security utilities: TOTP, recovery codes, security log helpers.
 */
import * as OTPAuth from "otpauth";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "./supabase";

// ---------------------------------------------------------------------------
// TOTP (Google Authenticator compatible)
// ---------------------------------------------------------------------------

/** Generate a new TOTP secret encoded as base32. */
export function generateTotpSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

/** Build an otpauth:// URI for QR-code display. */
export function buildTotpUri(secret: string, email: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: "Sky Style",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.toString();
}

/** Verify a 6-digit TOTP code. Returns true if valid (±1 step window). */
export function verifyTotp(secret: string, token: string): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      issuer: "Sky Style",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Recovery Codes
// ---------------------------------------------------------------------------

const RECOVERY_CODE_COUNT = 10;
const BCRYPT_ROUNDS = 10;

/** Generate 10 plaintext recovery codes (shown once to the user). */
export function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    // Format: XXXX-XXXX-XXXX (12 hex chars grouped for readability)
    const raw = randomBytes(6).toString("hex").toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`);
  }
  return codes;
}

/** Hash plaintext codes (bcrypt), then store in DB. Invalidates previous codes. */
export async function storeRecoveryCodes(userId: string, codes: string[]): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Delete existing codes
  await supabase.from("recovery_codes").delete().eq("user_id", userId);

  // Hash and insert new ones
  const rows = await Promise.all(
    codes.map(async (code) => ({
      user_id: userId,
      code_hash: await bcrypt.hash(code, BCRYPT_ROUNDS),
    }))
  );

  const { error } = await supabase.from("recovery_codes").insert(rows);
  if (error) throw new Error(`Failed to store recovery codes: ${error.message}`);
}

/**
 * Attempt to use a recovery code for authentication.
 * Marks the code as used (sets used_at) and returns true if a valid
 * unused code was found.
 */
export async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { data: rows } = await supabase
    .from("recovery_codes")
    .select("id, code_hash")
    .eq("user_id", userId)
    .is("used_at", null);

  if (!rows?.length) return false;

  for (const row of rows) {
    const match = await bcrypt.compare(code, row.code_hash);
    if (match) {
      await supabase
        .from("recovery_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", row.id);
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Security Audit Logs
// ---------------------------------------------------------------------------

export type SecurityEventType =
  | "login"
  | "logout"
  | "password_changed"
  | "passkey_added"
  | "passkey_removed"
  | "mfa_enabled"
  | "mfa_disabled"
  | "recovery_codes_generated"
  | "provider_linked"
  | "provider_unlinked"
  | "deletion_requested"
  | "deletion_cancelled"
  | "data_export";

export async function logSecurityEvent(
  userId: string,
  eventType: SecurityEventType,
  metadata: Record<string, unknown> = {},
  ipAddress?: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("security_logs").insert({
    user_id: userId,
    event_type: eventType,
    metadata,
    ip_address: ipAddress ?? null,
  });
  if (error) {
    // Non-fatal: log to console but don't crash the request
    console.error("[security_log] Failed to write audit log:", error);
  }
}
