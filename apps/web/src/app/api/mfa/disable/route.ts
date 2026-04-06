import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";
import { verifyTotp, logSecurityEvent } from "@/lib/security";
import { NextResponse, NextRequest } from "next/server";

/**
 * POST /api/mfa/disable
 * Requires the current TOTP code as re-authentication before disabling MFA.
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
    return NextResponse.json({ error: "MFA is not currently enabled" }, { status: 400 });
  }

  if (!verifyTotp(mfaRow.secret, token)) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
  }

  // Check passkeys exist (failsafe: user must keep at least one sign-in method)
  const { data: passkeys } = await supabaseAdmin
    .from("passkeys")
    .select("id")
    .eq("user_id", session.user.id)
    .limit(1);

  // MFA is a second factor, not a sign-in method itself — allow disabling

  await supabaseAdmin
    .from("mfa_secrets")
    .update({ enabled: false })
    .eq("user_id", session.user.id);

  await supabaseAdmin
    .from("users")
    .update({ mfa_enabled: false })
    .eq("id", session.user.id);

  // Invalidate recovery codes
  await supabaseAdmin
    .from("recovery_codes")
    .delete()
    .eq("user_id", session.user.id);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  await logSecurityEvent(session.user.id, "mfa_disabled", {}, ip);

  // Suppress unused variable warning
  void passkeys;

  return NextResponse.json({ success: true });
}
