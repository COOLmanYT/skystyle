export const dynamic = "force-dynamic";
/**
 * POST /api/style
 *
 * Body: { lat: number; lon: number; userApiKey?: string }
 *
 * Returns an AI-generated outfit recommendation based on real-time weather data.
 * Auth-protected. Pro users have credits deducted. Free users get 5 AI uses/day.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getWeather } from "@/lib/weather";
import { getStyleRecommendation } from "@/lib/ai";
import { deductCredit, getCredits } from "@/lib/credits";
import { incrementUsage, canUseFeature, getDailyLimitsInfo } from "@/lib/daily-usage";
import { syncPublicUser } from "@/lib/sync-user";

export async function POST(req: NextRequest) {
  // 1. Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Sync NextAuth user to public.users (required for FK references in app tables)
  await syncPublicUser(session);

  // 2. Parse body
  let body: { lat?: number; lon?: number; userApiKey?: string; gender?: string; shareLocation?: boolean; forceCloset?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { lat, lon, userApiKey, gender, shareLocation, forceCloset } = body;
  if (typeof lat !== "number" || typeof lon !== "number" || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json(
      { error: "lat must be between -90 and 90, lon between -180 and 180" },
      { status: 400 }
    );
  }

  // 3. Load user profile + settings
  const [profileResult, settingsResult, closetResult] = await Promise.all([
    supabaseAdmin.from("users").select("is_pro").eq("id", userId).single(),
    supabaseAdmin.from("settings").select("*").eq("user_id", userId).single(),
    supabaseAdmin.from("closet").select("items").eq("user_id", userId).single(),
  ]);

  const isPro: boolean = profileResult.data?.is_pro ?? false;
  const settings = settingsResult.data ?? {};

  // Closet: free users can use it 1x/day; Pro unlimited
  let closetItems: string[] = closetResult.data?.items ?? [];
  if (!isPro && closetItems.length > 0) {
    const { allowed } = await canUseFeature(userId, "closet_uses", isPro);
    if (!allowed) {
      closetItems = []; // Don't send closet data if limit reached
    } else {
      await incrementUsage(userId, "closet_uses", isPro);
    }
  }

  const unitPreference: "metric" | "imperial" =
    isPro && settings.unit_preference === "imperial" ? "imperial" : "metric";
  const customSystemPrompt: string | undefined = isPro
    ? settings.custom_system_prompt ?? undefined
    : undefined;
  const customSourceUrl: string | undefined = isPro
    ? settings.custom_source_url ?? undefined
    : undefined;

  // 4. Credits / daily limit check
  if (isPro) {
    const balance = await getCredits(userId);
    if (balance <= 0) {
      return NextResponse.json(
        { error: "Insufficient credits. Your weekly credits reset in a few days." },
        { status: 402 }
      );
    }
  } else {
    // Free users: 5 AI uses per day
    const { allowed, used, limit } = await canUseFeature(userId, "ai_uses", isPro);
    if (!allowed) {
      return NextResponse.json(
        { error: `Daily AI limit reached (${used}/${limit}). Upgrade to Pro for unlimited access.` },
        { status: 429 }
      );
    }
  }

  // 5. Fetch weather
  let weather;
  try {
    weather = await getWeather(lat, lon, customSourceUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Weather fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 6. Get AI recommendation (use BYOK if provided and user is Pro)
  let recommendation;
  try {
    recommendation = await getStyleRecommendation({
      weather,
      closetItems,
      unitPreference,
      customSystemPrompt,
      userApiKey: isPro ? userApiKey : undefined,
      gender: typeof gender === "string" ? gender.slice(0, 30) : undefined,
      shareLocation: shareLocation === true,
      forceCloset: forceCloset === true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 7. Deduct credit / increment daily usage
  if (isPro) {
    await deductCredit(userId);
  } else {
    await incrementUsage(userId, "ai_uses", isPro);
  }

  const dailyLimits = await getDailyLimitsInfo(userId, isPro);

  return NextResponse.json({
    weather,
    recommendation,
    meta: {
      isPro,
      unitPreference,
      creditsRemaining: isPro ? (await getCredits(userId)) : null,
      dailyLimits,
    },
  });
}
