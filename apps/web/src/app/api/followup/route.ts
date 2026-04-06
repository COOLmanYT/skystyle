export const dynamic = "force-dynamic";
/**
 * POST /api/followup
 *
 * Body: { message: string; previousOutfit: string; previousReasoning: string;
 *         weather: WeatherData; userApiKey?: string }
 *
 * Sends a follow-up prompt to modify AI recommendations.
 * Free: 10/day, Pro: 100/day.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getFollowUpRecommendation } from "@/lib/ai";
import { canUseFeature, incrementUsage, getDailyLimitsInfo } from "@/lib/daily-usage";
import { syncPublicUser } from "@/lib/sync-user";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Sync NextAuth user to public.users (required for FK references in app tables)
  await syncPublicUser(session);

  let body: {
    message?: string;
    previousOutfit?: string;
    previousReasoning?: string;
    weather?: Record<string, unknown>;
    userApiKey?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { message, previousOutfit, previousReasoning, weather, userApiKey } = body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (!previousOutfit || !weather) {
    return NextResponse.json({ error: "previousOutfit and weather are required" }, { status: 400 });
  }

  // Check Pro/Dev status
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  const isPro = profile?.is_pro ?? false;
  const isDev = profile?.is_dev ?? false;

  // Check daily follow-up limit (devs bypass)
  if (!isDev) {
    const { allowed, used, limit } = await canUseFeature(userId, "follow_ups", isPro, isDev);
    if (!allowed) {
      return NextResponse.json(
        { error: `Daily follow-up limit reached (${used}/${limit}). ${isPro ? "Try again tomorrow." : "Upgrade to Pro for 100 follow-ups per day."}` },
        { status: 429 }
      );
    }
  }

  // Load settings
  const { data: settings } = await supabaseAdmin
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  const unitPreference = settings?.unit_preference === "imperial" ? "imperial" as const : "metric" as const;
  const customSystemPrompt = (isPro || isDev) ? settings?.custom_system_prompt : undefined;

  let recommendation;
  try {
    recommendation = await getFollowUpRecommendation({
      previousOutfit: String(previousOutfit),
      previousReasoning: String(previousReasoning ?? ""),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      weather: weather as any,
      followUpMessage: message.trim(),
      unitPreference,
      customSystemPrompt,
      userApiKey: (isPro || isDev) ? userApiKey : undefined,
      isDev,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Increment follow-up usage (devs bypass)
  if (!isDev) {
    await incrementUsage(userId, "follow_ups", isPro, isDev);
  }

  const dailyLimits = await getDailyLimitsInfo(userId, isPro, isDev);

  return NextResponse.json({
    recommendation,
    meta: { isPro, isDev, dailyLimits },
  });
}
