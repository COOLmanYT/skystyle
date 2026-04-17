export const dynamic = "force-dynamic";

/**
 * POST /api/v1/recweath
 *
 * Combined endpoint — returns an AI outfit recommendation together with the
 * full weather data used to generate it.  Useful when a client needs both in
 * a single round-trip.
 * Authenticated via API key.
 *
 * Authentication:
 *   Authorization: Bearer sk_live_<token>
 *
 * Request body (JSON):
 *   lat     number  required  Latitude  (-90 to 90)
 *   lon     number  required  Longitude (-180 to 180)
 *   unit    string  optional  "metric" (default) | "imperial"
 *   gender  string  optional  Gender context for recommendations (max 30 chars)
 *
 * Response (200):
 *   outfit        string  Outfit recommendation text
 *   reasoning     string  Explanation linking weather to choices
 *   weather       object  Full weather snapshot (same shape as /api/v1/weather)
 *   model         string  AI model used
 *   generated_at  string  ISO-8601 UTC timestamp
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getWeather } from "@/lib/weather";
import { getStyleRecommendation } from "@/lib/ai";
import { canUseFeature, incrementUsage } from "@/lib/daily-usage";
import { getCredits, deductCredit, CreditRecord } from "@/lib/credits";
import { withApiAuth, ApiKeyContext } from "@/lib/api-middleware";

const LAT_MIN = -90;
const LAT_MAX = 90;
const LON_MIN = -180;
const LON_MAX = 180;

interface RecWeathBody {
  lat?: unknown;
  lon?: unknown;
  unit?: unknown;
  gender?: unknown;
}

/** Return the next weekly reset date for a user's credits, or a fallback string. */
async function getCreditsResetDate(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("credits")
    .select("last_reset_date")
    .eq("user_id", userId)
    .single();
  if (!data) return "within 7 days";
  const record = data as Pick<CreditRecord, "last_reset_date">;
  const reset = new Date(record.last_reset_date);
  reset.setDate(reset.getDate() + 7);
  return reset.toISOString().split("T")[0];
}

function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

function kmhToMph(kmh: number): number {
  return Math.round(kmh * 0.621371);
}

async function handleRecWeath(
  req: NextRequest,
  ctx: ApiKeyContext
): Promise<NextResponse> {
  const { userId } = ctx;

  // 1. Parse and validate body
  let body: RecWeathBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { lat, lon } = body;
  if (
    typeof lat !== "number" || typeof lon !== "number" ||
    lat < LAT_MIN || lat > LAT_MAX || lon < LON_MIN || lon > LON_MAX
  ) {
    return NextResponse.json(
      { error: `lat must be a number between ${LAT_MIN} and ${LAT_MAX}, and lon between ${LON_MIN} and ${LON_MAX}.` },
      { status: 400 }
    );
  }

  if (body.unit !== undefined && body.unit !== "metric" && body.unit !== "imperial") {
    return NextResponse.json(
      { error: "unit must be \"metric\" or \"imperial\"." },
      { status: 400 }
    );
  }
  const unit: "metric" | "imperial" =
    body.unit === "imperial" ? "imperial" : "metric";

  const gender =
    typeof body.gender === "string" && body.gender.trim()
      ? body.gender.trim().slice(0, 30)
      : undefined;

  // 2. Load user tier
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("is_pro, is_dev")
    .eq("id", userId)
    .single();

  const isPro = profile?.is_pro ?? false;
  const isDev = profile?.is_dev ?? false;

  // 3. Credit / daily-limit check
  if (!isDev) {
    if (isPro) {
      const balance = await getCredits(userId);
      if (balance <= 0) {
        const resetDate = await getCreditsResetDate(userId);
        return NextResponse.json(
          { error: `Insufficient credits. Weekly credits reset on ${resetDate}.` },
          { status: 402 }
        );
      }
    } else {
      const { allowed, used, limit } = await canUseFeature(userId, "ai_uses", isPro, isDev);
      if (!allowed) {
        return NextResponse.json(
          { error: `Daily AI limit reached (${used}/${limit}). Upgrade to Pro for more.` },
          { status: 429 }
        );
      }
    }
  }

  // 4. Fetch weather
  let weather;
  try {
    weather = await getWeather(lat, lon);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Weather fetch failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 5. Get AI recommendation
  let recommendation;
  try {
    recommendation = await getStyleRecommendation({
      weather,
      closetItems: [],
      unitPreference: unit,
      gender,
      shareLocation: false,
      forceCloset: false,
      isDev,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 6. Deduct credit / increment usage
  if (!isDev) {
    if (isPro) {
      await deductCredit(userId);
    } else {
      await incrementUsage(userId, "ai_uses", isPro, isDev);
    }
  }

  // 7. Return recommendation + full weather snapshot
  const isImperial = unit === "imperial";
  return NextResponse.json({
    outfit: recommendation.outfit,
    reasoning: recommendation.reasoning,
    weather: {
      temp: isImperial ? celsiusToFahrenheit(weather.temp) : weather.temp,
      feels_like: isImperial ? celsiusToFahrenheit(weather.feelsLike) : weather.feelsLike,
      temp_unit: isImperial ? "°F" : "°C",
      humidity_pct: weather.humidity,
      wind_speed: isImperial ? kmhToMph(weather.windSpeed) : weather.windSpeed,
      wind_speed_unit: isImperial ? "mph" : "km/h",
      wind_dir: weather.windDir,
      description: weather.description,
      rain_chance_pct: weather.rainChance,
      uv_index: weather.uvIndex,
      is_day: weather.isDay,
      alerts: weather.alerts,
      source: weather.source,
    },
    model: recommendation.modelUsed ?? "unknown",
    generated_at: new Date().toISOString(),
  });
}

export const POST = withApiAuth(handleRecWeath);
