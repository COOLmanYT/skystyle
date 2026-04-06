export const dynamic = "force-dynamic";
/**
 * GET /api/demo/geocode?q=<location-query>
 *
 * Public (no auth) geocode endpoint for the homepage live demo.
 * Uses OpenStreetMap Nominatim — free, no API key required.
 */

import { NextRequest, NextResponse } from "next/server";

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json(
      { error: "q query parameter is required" },
      { status: 400 }
    );
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "0");

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "SkyStyle/1.0 (weather-outfit-stylist; github.com/COOLmanYT/what2wear)",
        "Accept-Language": "en",
      },
      next: { revalidate: 3600 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Geocoding request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: `Geocoding service error: ${res.status}` },
      { status: 502 }
    );
  }

  let results: NominatimResult[];
  try {
    results = await res.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid response from geocoding service" },
      { status: 502 }
    );
  }

  if (results.length === 0) {
    return NextResponse.json(
      { error: "Location not found. Try a more specific name." },
      { status: 404 }
    );
  }

  const candidates = results.map((r) => ({
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    displayName: r.display_name,
  }));

  return NextResponse.json({ candidates });
}
