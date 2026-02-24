export const dynamic = "force-dynamic";
/**
 * POST /api/style
 *
 * Body: { lat: number; lon: number }
 *
 * Returns an AI-generated outfit recommendation based on real-time weather data.
 * Auth-protected. Pro users have credits deducted.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getWeather } from "@/lib/weather";
import { getStyleRecommendation } from "@/lib/ai";
import { deductCredit, getCredits } from "@/lib/credits";

export async function POST(req: NextRequest) {
  // 1. Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // 2. Parse body
  let body: { lat?: number; lon?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { lat, lon } = body;
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
  const closetItems: string[] = closetResult.data?.items ?? [];

  const unitPreference: "metric" | "imperial" =
    isPro && settings.unit_preference === "imperial" ? "imperial" : "metric";
  const customSystemPrompt: string | undefined = isPro
    ? settings.custom_system_prompt ?? undefined
    : undefined;
  const customSourceUrl: string | undefined = isPro
    ? settings.custom_source_url ?? undefined
    : undefined;

  // 4. Credits check (Pro users only)
  if (isPro) {
    const balance = await getCredits(userId);
    if (balance <= 0) {
      return NextResponse.json(
        { error: "Insufficient credits. Your weekly credits reset in a few days." },
        { status: 402 }
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

  // 6. Get AI recommendation
  let recommendation;
  try {
    recommendation = await getStyleRecommendation({
      weather,
      closetItems,
      unitPreference,
      customSystemPrompt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 7. Deduct credit (Pro only, after successful response)
  if (isPro) {
    await deductCredit(userId);
  }

  return NextResponse.json({
    weather,
    recommendation,
    meta: {
      isPro,
      unitPreference,
      creditsRemaining: isPro ? (await getCredits(userId)) : null,
    },
  });
}
