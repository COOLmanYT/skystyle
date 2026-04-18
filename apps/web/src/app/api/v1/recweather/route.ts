export const dynamic = "force-dynamic";

/**
 * POST /api/v1/recweather
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
 *   weather       object  Weather snapshot used to generate the recommendation
 *   model         string  AI model used
 *   generated_at  string  ISO-8601 UTC timestamp
 */

import { NextRequest, NextResponse } from "next/server";
import { getWeather } from "@/lib/weather";
import { getStyleRecommendation } from "@/lib/ai";
import { withApiAuth, ApiKeyContext, apiOptionsHandler } from "@/lib/api-middleware";

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

function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

function kmhToMph(kmh: number): number {
  return Math.round(kmh * 0.621371);
}

async function handleRecWeath(
  req: NextRequest,
  _ctx: ApiKeyContext  // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<NextResponse> {
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

  // 2. Fetch weather
  let weather;
  try {
    weather = await getWeather(lat, lon);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Weather fetch failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 3. Get AI recommendation
  let recommendation;
  try {
    recommendation = await getStyleRecommendation({
      weather,
      closetItems: [],
      unitPreference: unit,
      gender,
      shareLocation: false,
      forceCloset: false,
      isDev: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed.";
    const response = NextResponse.json({ error: message }, { status: 502 });
    response.headers.set("x-api-partial-success", "true");
    return response;
  }

  // 4. Return recommendation + full weather snapshot
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
export const OPTIONS = apiOptionsHandler;
