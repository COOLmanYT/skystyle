export const dynamic = "force-dynamic";

/**
 * GET /api/v1/health/db
 *
 * Health of Sky Style's database connection. No API key required.
 *
 * Checks the Supabase database by selecting a single row from the `users`
 * table and reports the round-trip latency.
 *
 * Response (200):
 *   status         string           "ok" | "degraded" | "error" | "unconfigured"
 *   providers      ProviderCheck[]  Single entry for the database (with latencyMs)
 *   timestamp      string           ISO-8601 UTC timestamp
 *   responseTimeMs number           Sky Style's own response time for this request (ms)
 *
 * Each ProviderCheck:
 *   provider    string  "supabase"
 *   configured  boolean Whether SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are set
 *   status      string  "ok" | "degraded" | "error" | "unconfigured"
 *   latencyMs   number  Database round-trip latency in ms (null if not checked)
 *   detail      string  Human-readable detail
 */

import { NextResponse } from "next/server";
import { checkSupabase, aggregateStatus } from "@/lib/health-checks";

export async function GET() {
  const start = Date.now();
  const providers = [await checkSupabase()];
  return NextResponse.json(
    {
      status: aggregateStatus(providers),
      providers,
      timestamp: new Date().toISOString(),
      responseTimeMs: Date.now() - start,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}
