export const dynamic = "force-dynamic";
/**
 * GET  /api/settings      – get user settings
 * PATCH /api/settings     – update user settings (Pro features gated)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabaseAdmin
    .from("settings")
    .select("*")
    .eq("user_id", session.user.id)
    .single();

  return NextResponse.json(data ?? {});
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Check Pro status for gated settings
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("is_pro")
    .eq("id", userId)
    .single();

  const isPro = profile?.is_pro ?? false;

  const updates = await req.json();
  const allowedKeys = isPro
    ? ["unit_preference", "custom_system_prompt", "custom_source_url"]
    : ["unit_preference"];

  const filtered: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (key in updates) filtered[key] = updates[key];
  }

  if (Object.keys(filtered).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await supabaseAdmin
    .from("settings")
    .upsert({ user_id: userId, ...filtered });

  return NextResponse.json({ success: true, updated: filtered });
}
