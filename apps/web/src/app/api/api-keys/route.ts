export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";
import { generateApiKey, hashApiKey } from "@/lib/api-keys";
import { getInitialApiKeyCredits } from "@/lib/api-key-credits";
import { logSecurityEvent } from "@/lib/security";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncPublicUser(session);

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, key_preview, created_at, revoked, credits_remaining, credits_used")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load API keys" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncPublicUser(session);

  const { key, preview } = generateApiKey();
  const keyHash = hashApiKey(key);
  const initialCredits = getInitialApiKeyCredits();

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .insert({
      user_id: session.user.id,
      key_hash: keyHash,
      key_preview: preview,
      revoked: false,
      credits_remaining: initialCredits,
      credits_used: 0,
    })
    .select("id, key_preview, created_at, revoked, credits_remaining, credits_used")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }

  await logSecurityEvent(session.user.id, "api_key_created", { key_id: data.id });

  return NextResponse.json({ apiKey: key, keyMeta: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncPublicUser(session);

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid key id" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .update({ revoked: true })
    .eq("id", id)
    .eq("user_id", session.user.id)
    .eq("revoked", false)
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  await logSecurityEvent(session.user.id, "api_key_revoked", { key_id: id });

  return NextResponse.json({ success: true });
}
