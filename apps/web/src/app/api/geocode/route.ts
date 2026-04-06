export const dynamic = "force-dynamic";
/**
 * GET /api/geocode?q=<location-query>
 *
 * Geocodes a free-text location string to { lat, lon, displayName }.
 * Uses OpenStreetMap Nominatim — free, no API key required.
 * Auth-protected to prevent public abuse.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
        // Nominatim requires a descriptive User-Agent
        "User-Agent": "SkyStyle/1.0 (weather-outfit-stylist; github.com/COOLmanYT/what2wear)",
        "Accept-Language": "en",
      },
      next: { revalidate: 3600 }, // cache geocoding results for 1 hour
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

  // Return the top 5 candidates so the client can offer a disambiguation list
  const candidates = results.map((r) => ({
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    displayName: r.display_name,
  }));

  return NextResponse.json({ candidates });
}
