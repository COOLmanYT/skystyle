export const dynamic = "force-dynamic";
/**
 * GET /api/weather?lat=<lat>&lon=<lon>
 *
 * Returns raw weather data for the given coordinates.
 * Auth-protected.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWeather } from "@/lib/weather";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const latStr = searchParams.get("lat");
  const lonStr = searchParams.get("lon");

  if (!latStr || !lonStr) {
    return NextResponse.json(
      { error: "lat and lon query parameters are required" },
      { status: 400 }
    );
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json(
      { error: "lat and lon must be valid numbers" },
      { status: 400 }
    );
  }

  try {
    const weather = await getWeather(lat, lon);
    return NextResponse.json(weather);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Weather fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
