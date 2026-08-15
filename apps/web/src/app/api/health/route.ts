export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Overall health of the Sky Style service. No API key required.
 *
 * This is a lightweight liveness check: it confirms the service is running
 * and reports which provider keys are configured (without ever exposing the
 * keys themselves). It does not perform outbound provider pings, so it stays
 * fast and free of external dependencies.
 *
 * For provider reachability, use:
 *   - GET /api/health/ai
 *   - GET /api/health/weather
 *
 * Response (200):
 *   status        string  "ok" — service is alive
 *   service       string  "skystyle"
 *   environment   string  Node environment (e.g. "production")
 *   timestamp     string  ISO-8601 UTC timestamp
 *   providers     object  Configured-state flags per provider category
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "skystyle",
      environment: process.env.NODE_ENV ?? "development",
      timestamp: new Date().toISOString(),
      providers: {
        ai: {
          openai: !!process.env.OPENAI_API_KEY,
          gemini: !!process.env.GEMINI_API_KEY,
          mistral: !!process.env.MISTRAL_API_KEY,
        },
        weather: {
          openweather: !!process.env.OPENWEATHER_API_KEY,
          weatherapi: !!process.env.WEATHERAPI_KEY,
          visualcrossing: !!process.env.VISUALCROSSING_API_KEY,
          pirateweather: !!process.env.PIRATEWEATHER_API_KEY,
          "open-meteo": true,
          bom: true,
        },
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}
