import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import { logSecurityEvent } from "@/lib/security";
import { NextResponse, NextRequest } from "next/server";

const RP_ID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const RP_NAME = "Sky Style";
const ORIGIN = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";

/**
 * GET /api/passkeys/register
 * Returns registration options (challenge). The challenge is cached server-side
 * in the user's session row (user_sessions) or a temporary Supabase row.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await syncPublicUser(session);

  // Fetch existing passkeys so we can exclude them
  const { data: existing } = await supabaseAdmin
    .from("passkeys")
    .select("credential_id, transports")
    .eq("user_id", session.user.id);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: session.user.id,
    userName: session.user.email,
    userDisplayName: session.user.name ?? session.user.email,
    attestationType: "none",
    excludeCredentials: (existing ?? []).map((c) => ({
      id: c.credential_id,
      type: "public-key",
      transports: c.transports ? (c.transports.split(",") as import("@simplewebauthn/types").AuthenticatorTransportFuture[]) : [],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  // Store challenge temporarily in a passkey_challenges table (use user_sessions for simplicity)
  await supabaseAdmin
    .from("user_sessions")
    .upsert(
      {
        user_id: session.user.id,
        session_token: `webauthn_reg_${session.user.id}`,
        browser: options.challenge,
      },
      { onConflict: "session_token" }
    );

  return NextResponse.json(options);
}

/**
 * POST /api/passkeys/register
 * Verifies the registration response and stores the new credential.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await syncPublicUser(session);

  const body: RegistrationResponseJSON & { displayName?: string } = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // Retrieve stored challenge
  const { data: challengeRow } = await supabaseAdmin
    .from("user_sessions")
    .select("browser")
    .eq("session_token", `webauthn_reg_${session.user.id}`)
    .single();

  if (!challengeRow?.browser) {
    return NextResponse.json({ error: "No pending registration challenge" }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challengeRow.browser,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  const { credentialID, credentialPublicKey, counter } =
    verification.registrationInfo;

  await supabaseAdmin.from("passkeys").insert({
    user_id: session.user.id,
    credential_id: Buffer.from(credentialID).toString("base64url"),
    public_key: Buffer.from(credentialPublicKey).toString("base64"),
    counter,
    transports: body.response?.transports?.join(",") ?? null,
    display_name: body.displayName ?? "Passkey",
  });

  // Clean up challenge
  await supabaseAdmin
    .from("user_sessions")
    .delete()
    .eq("session_token", `webauthn_reg_${session.user.id}`);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  await logSecurityEvent(session.user.id, "passkey_added", {
    displayName: body.displayName ?? "Passkey",
  }, ip);

  return NextResponse.json({ verified: true });
}
