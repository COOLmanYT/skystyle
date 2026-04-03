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
import { DEMO_USER_ID } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getWeather, CustomSource, SourceMode, MAX_CUSTOM_SOURCES } from "@/lib/weather";
import { getStyleRecommendation, getDevChatResponse } from "@/lib/ai";
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

  // Demo users are not persisted to Supabase — skip the sync step
  const isDemo = userId === DEMO_USER_ID || (session.user as unknown as Record<string, unknown>).plan === "demo";

  // Sync NextAuth user to public.users (required for FK references in app tables)
  if (!isDemo) {
    await syncPublicUser(session);
  }

  // 2. Parse body
  let body: {
    lat?: number; lon?: number; userApiKey?: string; gender?: string;
    shareLocation?: boolean; forceCloset?: boolean; unitPreference?: string;
    devMessage?: string; sourceMode?: string; customSources?: CustomSource[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { lat, lon, userApiKey, gender, shareLocation, forceCloset, devMessage } = body;
  if (typeof lat !== "number" || typeof lon !== "number" || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json(
      { error: "lat must be between -90 and 90, lon between -180 and 180" },
      { status: 400 }
    );
  }

  // 3. Load user profile + settings
  let isPro = false;
  let isDev = false;
  let settings: { unit_preference?: string; custom_system_prompt?: string; custom_source_url?: string } = {};
  let closetItems: string[] = [];

  if (isDemo) {
    // Demo users bypass all Supabase lookups — use empty defaults
    isPro = false;
    isDev = false;
  } else {
    const [profileResult, settingsResult, closetResult] = await Promise.all([
      supabaseAdmin.from("users").select("*").eq("id", userId).single(),
      supabaseAdmin.from("settings").select("*").eq("user_id", userId).single(),
      supabaseAdmin.from("closet").select("items").eq("user_id", userId).single(),
    ]);

    isPro = profileResult.data?.is_pro ?? false;
    isDev = profileResult.data?.is_dev ?? false;
    settings = (settingsResult.data ?? {}) as { unit_preference?: string; custom_system_prompt?: string; custom_source_url?: string };

    // Closet: free users can use it 1x/day; Pro/Dev/Demo unlimited-ish
    const rawCloset: string[] = closetResult.data?.items ?? [];
    if (!isPro && !isDev && rawCloset.length > 0) {
      const { allowed } = await canUseFeature(userId, "closet_uses", isPro, isDev, isDemo);
      if (!allowed) {
        closetItems = [];
      } else {
        await incrementUsage(userId, "closet_uses", isPro, isDev, isDemo);
        closetItems = rawCloset;
      }
    } else {
      closetItems = rawCloset;
    }
  }

  // Use unitPreference from request body (client state) if provided, else fall back to DB
  const unitPreference: "metric" | "imperial" =
    body.unitPreference === "imperial" || body.unitPreference === "metric"
      ? body.unitPreference
      : settings.unit_preference === "imperial" ? "imperial" : "metric";
  const customSystemPrompt: string | undefined = (isPro || isDev)
    ? settings.custom_system_prompt ?? undefined
    : undefined;
  const customSourceUrl: string | undefined = (isPro || isDev)
    ? settings.custom_source_url ?? undefined
    : undefined;

  // 4. Credits / daily limit check (devs and demos bypass credit deduction)
  if (!isDev && !isDemo) {
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
      const { allowed, used, limit } = await canUseFeature(userId, "ai_uses", isPro, isDev, isDemo);
      if (!allowed) {
        return NextResponse.json(
          { error: `Daily AI limit reached (${used}/${limit}). Upgrade to Pro for unlimited access.` },
          { status: 429 }
        );
      }
    }
  } else if (isDemo) {
    // Demo users: 50 AI uses per day (10× free). Still enforce the limit.
    const { allowed, used, limit } = await canUseFeature(userId, "ai_uses", isPro, isDev, isDemo);
    if (!allowed) {
      return NextResponse.json(
        { error: `Demo daily AI limit reached (${used}/${limit}).` },
        { status: 429 }
      );
    }
  }

  // Dev mode: direct AI chat without weather data
  if (isDev && devMessage) {
    let recommendation;
    try {
      recommendation = await getDevChatResponse(devMessage, userApiKey);
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI request failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
    const dailyLimits = await getDailyLimitsInfo(userId, isPro, isDev, isDemo);
    return NextResponse.json({
      recommendation,
      meta: {
        isPro,
        isDev,
        unitPreference,
        creditsRemaining: null,
        dailyLimits,
        modelUsed: recommendation.modelUsed ?? "unknown",
      },
    });
  }

  // Parse custom source settings from client (stored in localStorage)
  const sourceMode: SourceMode =
    body.sourceMode === "custom" || body.sourceMode === "both" ? body.sourceMode : "builtin";
  const customSources: CustomSource[] = Array.isArray(body.customSources)
    ? body.customSources.filter(
        (s): s is CustomSource =>
          typeof s === "object" && s !== null &&
          typeof s.id === "string" &&
          typeof s.name === "string" &&
          typeof s.value === "string" &&
          ["rss", "api_key", "url"].includes(s.type)
      ).slice(0, MAX_CUSTOM_SOURCES)
    : [];

  // 5. Fetch weather
  let weather;
  try {
    weather = await getWeather(lat, lon, customSourceUrl, sourceMode, customSources);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Weather fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 6. Get AI recommendation (use BYOK if provided and user is Pro/Dev)
  let recommendation;
  try {
    recommendation = await getStyleRecommendation({
      weather,
      closetItems,
      unitPreference,
      customSystemPrompt,
      userApiKey: (isPro || isDev) ? userApiKey : undefined,
      gender: typeof gender === "string" ? gender.slice(0, 30) : undefined,
      shareLocation: shareLocation === true,
      forceCloset: forceCloset === true,
      isDev,
      customContext: weather.customContext,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 7. Deduct credit / increment daily usage (devs bypass)
  if (!isDev && !isDemo) {
    if (isPro) {
      await deductCredit(userId);
    } else {
      await incrementUsage(userId, "ai_uses", isPro, isDev, isDemo);
    }
  } else if (isDemo) {
    await incrementUsage(userId, "ai_uses", isPro, isDev, isDemo);
  }

  const dailyLimits = await getDailyLimitsInfo(userId, isPro, isDev, isDemo);

  return NextResponse.json({
    weather,
    recommendation,
    meta: {
      isPro,
      isDev,
      unitPreference,
      creditsRemaining: isPro ? (await getCredits(userId)) : null,
      dailyLimits,
      modelUsed: recommendation.modelUsed ?? "unknown",
    },
  });
}
