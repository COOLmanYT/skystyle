export const dynamic = "force-dynamic";
/**
 * GET  /api/settings      – get user settings
 * PATCH /api/settings     – update user settings (Pro features gated)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { canUseFeature, incrementUsage } from "@/lib/daily-usage";
import { syncPublicUser } from "@/lib/sync-user";

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

  // Sync NextAuth user to public.users (required for FK references in app tables)
  await syncPublicUser(session);

  // Check Pro status for gated settings
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("is_pro")
    .eq("id", userId)
    .single();

  const isPro = profile?.is_pro ?? false;

  const updates = await req.json();
  const allowedKeys = isPro
    ? ["unit_preference", "custom_system_prompt", "custom_source_url", "custom_weather_api_key"]
    : ["unit_preference", "custom_source_url"];

  const filtered: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (key in updates) filtered[key] = updates[key];
  }

  if (Object.keys(filtered).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Free users: source picker limited to 1x/day
  if (!isPro && ("custom_source_url" in filtered)) {
    const { allowed } = await canUseFeature(userId, "source_picks", false);
    if (!allowed) {
      return NextResponse.json(
        { error: "Free users can only change weather source once per day. Upgrade to Pro for unlimited." },
        { status: 429 }
      );
    }
    await incrementUsage(userId, "source_picks", false);
  }

  await supabaseAdmin
    .from("settings")
    .upsert({ user_id: userId, ...filtered });

  return NextResponse.json({ success: true, updated: filtered });
}
