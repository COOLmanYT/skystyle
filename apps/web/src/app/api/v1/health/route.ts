export const dynamic = "force-dynamic";

/**
 * GET /api/v1/health
 *
 * Overall health of the Sky Style service. No API key required.
 *
 * Runs the database, AI, and weather provider checks in parallel and returns
 * a consolidated status plus Sky Style's own response time. Each service
 * category reports its own status and response time.
 *
 * For per-provider detail, use:
 *   - GET /api/v1/health/ai      (per AI provider, optional ?provider=)
 *   - GET /api/v1/health/weather (per weather provider, optional ?provider=)
 *   - GET /api/v1/health/db      (database connection detail)
 *
 * Response (200):
 *   status        string          "ok" | "degraded" | "error" | "unconfigured"
 *   responseTime  number          Sky Style's own response time for this request (ms)
 *   services      object          Per-category health (see below)
 *
 * services.<category>:
 *   status        string          "ok" | "degraded" | "error" | "unconfigured"
 *   responseTime  number          Category round-trip response time in ms (null if not measured)
 *
 *   categories: database, ai, weather
 */

import { NextResponse } from "next/server";
import { checkAllServices, overallStatus } from "@/lib/health-checks";

export async function GET() {
  const start = Date.now();
  const services = await checkAllServices();

  return NextResponse.json(
    {
      status: overallStatus(services),
      responseTime: Date.now() - start,
      services,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}
