import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";
import { generateTotpSecret, buildTotpUri } from "@/lib/security";
import { NextResponse } from "next/server";
import QRCode from "qrcode";

/**
 * POST /api/mfa/setup
 * Generates a new TOTP secret and returns the otpauth URI + QR code PNG (data URL).
 * The secret is saved as pending (enabled=false) until verified via /api/mfa/verify.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await syncPublicUser(session);

  const secret = generateTotpSecret();
  const uri = buildTotpUri(secret, session.user.email);

  // Store (or overwrite) the pending secret
  const { error } = await supabaseAdmin
    .from("mfa_secrets")
    .upsert({ user_id: session.user.id, secret, enabled: false }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const qrDataUrl = await QRCode.toDataURL(uri, { width: 200, margin: 1 });

  return NextResponse.json({ secret, uri, qrDataUrl });
}
