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

function cleanLabel(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

function hasMissingMetadataColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    (error.code === "42703" || error.code === "PGRST204") &&
    (message.includes("nickname") || message.includes("folder"))
  );
}

const API_KEY_COLUMNS = "id, key_preview, created_at, revoked, credits_remaining, credits_used, nickname, folder";
const LEGACY_API_KEY_COLUMNS = "id, key_preview, created_at, revoked, credits_remaining, credits_used";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncPublicUser(session);

  let { data, error } = await supabaseAdmin
    .from("api_keys")
    .select(API_KEY_COLUMNS)
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  // Existing deployments from before v5 do not yet have key labels. Keep the
  // dashboard usable until the idempotent schema migration has been applied.
  if (hasMissingMetadataColumn(error)) {
    const legacyResult = await supabaseAdmin
      .from("api_keys")
      .select(LEGACY_API_KEY_COLUMNS)
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    data = (legacyResult.data ?? []).map((key) => ({ ...key, nickname: null, folder: null }));
    error = legacyResult.error;
  }

  if (error) {
    console.error("[api-keys] Failed to load API keys:", error.code, error.message);
    return NextResponse.json({ error: "Failed to load API keys" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncPublicUser(session);

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { data: profile, error: profileError } = await supabaseAdmin.from("users").select("is_pro, is_dev").eq("id", session.user.id).maybeSingle();
  if (profileError) return NextResponse.json({ error: "Failed to load your API plan." }, { status: 500 });
  const keyLimit = profile?.is_dev ? Infinity : profile?.is_pro ? 20 : 3;
  const { count, error: countError } = await supabaseAdmin.from("api_keys").select("id", { count: "exact", head: true }).eq("user_id", session.user.id).eq("revoked", false);
  if (countError) return NextResponse.json({ error: "Failed to check API key limit." }, { status: 500 });
  if ((count ?? 0) >= keyLimit) return NextResponse.json({ error: `Your plan allows up to ${keyLimit} active API keys.` }, { status: 409 });

  const { key, preview } = generateApiKey();
  const keyHash = hashApiKey(key);
  const initialCredits = getInitialApiKeyCredits();

  const insertPayload = {
    user_id: session.user.id,
    key_hash: keyHash,
    key_preview: preview,
    revoked: false,
    credits_remaining: initialCredits,
    credits_used: 0,
    nickname: cleanLabel(body.nickname, 80),
    folder: cleanLabel(body.folder, 80),
  };
  let { data, error } = await supabaseAdmin
    .from("api_keys")
    .insert(insertPayload)
    .select(API_KEY_COLUMNS)
    .single();

  if (hasMissingMetadataColumn(error)) {
    const { nickname: _nickname, folder: _folder, ...legacyPayload } = insertPayload;
    const legacyResult = await supabaseAdmin
      .from("api_keys")
      .insert(legacyPayload)
      .select(LEGACY_API_KEY_COLUMNS)
      .single();
    data = legacyResult.data ? { ...legacyResult.data, nickname: null, folder: null } : null;
    error = legacyResult.error;
  }

  if (error || !data) {
    console.error("[api-keys] Failed to create API key:", error?.code, error?.message);
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

  const updates: Record<string, unknown> = {};
  if (body?.action === "revoke") updates.revoked = true;
  if ("nickname" in body) updates.nickname = cleanLabel(body.nickname, 80);
  if ("folder" in body) updates.folder = cleanLabel(body.folder, 80);
  if (!Object.keys(updates).length) return NextResponse.json({ error: "No API key update supplied" }, { status: 400 });
  let query = supabaseAdmin
    .from("api_keys")
    .update(updates)
    .eq("id", id)
    .eq("user_id", session.user.id);
  if (body?.action === "revoke") query = query.eq("revoked", false);
  const { data, error } = await query.select("id").single();

  if (error || !data) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  await logSecurityEvent(session.user.id, body?.action === "revoke" ? "api_key_revoked" : "api_key_updated", { key_id: id });

  return NextResponse.json({ success: true });
}
