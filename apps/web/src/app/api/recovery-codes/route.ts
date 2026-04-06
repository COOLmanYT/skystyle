import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";
import { generateRecoveryCodes, storeRecoveryCodes, logSecurityEvent, verifyTotp } from "@/lib/security";
import { NextResponse, NextRequest } from "next/server";

/**
 * POST /api/recovery-codes
 * Regenerates 10 new recovery codes. Requires re-authentication with TOTP.
 * Returns plaintext codes (only time they're visible).
 *
 * Body: { token: "123456" }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await syncPublicUser(session);

  const body = await req.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token.replace(/\s/g, "") : "";
  if (!/^\d{6}$/.test(token)) {
    return NextResponse.json({ error: "Token must be 6 digits" }, { status: 400 });
  }

  const { data: mfaRow } = await supabaseAdmin
    .from("mfa_secrets")
    .select("secret, enabled")
    .eq("user_id", session.user.id)
    .single();

  if (!mfaRow?.enabled) {
    return NextResponse.json({ error: "MFA is not enabled" }, { status: 400 });
  }

  if (!verifyTotp(mfaRow.secret, token)) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
  }

  const recoveryCodes = generateRecoveryCodes();
  await storeRecoveryCodes(session.user.id, recoveryCodes);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  await logSecurityEvent(session.user.id, "recovery_codes_generated", {}, ip);

  return NextResponse.json({ recoveryCodes });
}
