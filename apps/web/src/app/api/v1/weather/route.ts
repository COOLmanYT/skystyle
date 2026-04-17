export const dynamic = "force-dynamic";

/**
 * GET /api/v1/weather?lat=<lat>&lon=<lon>
 *
 * Returns current weather data for the given coordinates.
 * Authenticated via API key.
 *
 * Authentication:
 *   Authorization: Bearer sk_live_<token>
 *
 * Query parameters:
 *   lat   number  required  Latitude  (-90 to 90)
 *   lon   number  required  Longitude (-180 to 180)
 *   unit  string  optional  "metric" (default) | "imperial"
 *
 * Response (200):
 *   temp          number  Temperature
 *   feels_like    number  Apparent temperature
 *   temp_unit     string  "°C" or "°F"
 *   humidity_pct  number  Humidity percentage (0–100)
 *   wind_speed    number  Wind speed
 *   wind_speed_unit string "km/h" or "mph"
 *   wind_dir      string  Cardinal direction (e.g. "NW")
 *   description   string  Weather description
 *   rain_chance_pct number  Precipitation probability (0–100)
 *   uv_index      number  UV index
 *   is_day        boolean Whether it is currently daytime
 *   alerts        string[] Active weather alerts (may be empty)
 *   source        string  Data source identifier
 *   retrieved_at  string  ISO-8601 UTC timestamp
 */

import { NextRequest, NextResponse } from "next/server";
import { getWeather } from "@/lib/weather";
import { withApiAuth, ApiKeyContext } from "@/lib/api-middleware";

const LAT_MIN = -90;
const LAT_MAX = 90;
const LON_MIN = -180;
const LON_MAX = 180;

function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

function kmhToMph(kmh: number): number {
  return Math.round(kmh * 0.621371);
}

async function handleWeather(
  req: NextRequest,
  _ctx: ApiKeyContext  // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;

  const latStr = searchParams.get("lat");
  const lonStr = searchParams.get("lon");

  if (!latStr || !lonStr) {
    return NextResponse.json(
      { error: "lat and lon query parameters are required." },
      { status: 400 }
    );
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (
    isNaN(lat) || isNaN(lon) ||
    lat < LAT_MIN || lat > LAT_MAX ||
    lon < LON_MIN || lon > LON_MAX
  ) {
    return NextResponse.json(
      { error: `lat must be between ${LAT_MIN} and ${LAT_MAX}, lon between ${LON_MIN} and ${LON_MAX}.` },
      { status: 400 }
    );
  }

  const unitParam = searchParams.get("unit");
  if (unitParam !== null && unitParam !== "metric" && unitParam !== "imperial") {
    return NextResponse.json(
      { error: "unit must be \"metric\" or \"imperial\"." },
      { status: 400 }
    );
  }
  const isImperial = unitParam === "imperial";

  let weather;
  try {
    weather = await getWeather(lat, lon);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Weather fetch failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({
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
    retrieved_at: new Date().toISOString(),
  });
}

export const GET = withApiAuth(handleWeather);
