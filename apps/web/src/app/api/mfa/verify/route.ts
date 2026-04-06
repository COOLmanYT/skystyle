import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";
import { verifyTotp, generateRecoveryCodes, storeRecoveryCodes, logSecurityEvent } from "@/lib/security";
import { NextResponse, NextRequest } from "next/server";

/**
 * POST /api/mfa/verify
 * Validates a TOTP code and, if correct, enables MFA for the user.
 * Returns 10 single-use recovery codes (shown only once).
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
    .select("secret")
    .eq("user_id", session.user.id)
    .single();

  if (!mfaRow?.secret) {
    return NextResponse.json({ error: "No pending MFA setup found" }, { status: 400 });
  }

  if (!verifyTotp(mfaRow.secret, token)) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  // Enable MFA
  await supabaseAdmin
    .from("mfa_secrets")
    .update({ enabled: true })
    .eq("user_id", session.user.id);

  await supabaseAdmin
    .from("users")
    .update({ mfa_enabled: true })
    .eq("id", session.user.id);

  // Generate + store recovery codes
  const recoveryCodes = generateRecoveryCodes();
  await storeRecoveryCodes(session.user.id, recoveryCodes);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  await logSecurityEvent(session.user.id, "mfa_enabled", {}, ip);

  return NextResponse.json({ success: true, recoveryCodes });
}
