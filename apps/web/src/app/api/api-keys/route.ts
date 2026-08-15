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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncPublicUser(session);

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, key_preview, created_at, revoked, credits_remaining, credits_used, nickname, folder")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
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

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .insert({
      user_id: session.user.id,
      key_hash: keyHash,
      key_preview: preview,
      revoked: false,
      credits_remaining: initialCredits,
      credits_used: 0,
      nickname: cleanLabel(body.nickname, 80),
      folder: cleanLabel(body.folder, 80),
    })
    .select("id, key_preview, created_at, revoked, credits_remaining, credits_used, nickname, folder")
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
