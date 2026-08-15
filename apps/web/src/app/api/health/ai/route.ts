export const dynamic = "force-dynamic";

/**
 * GET /api/health/ai
 *
 * Health of Sky Style's AI providers. No API key required.
 *
 * By default, all configured AI providers are checked in parallel. Pass a
 * `provider` query parameter to check a single provider.
 *
 * Query parameters:
 *   provider  string  optional  One of: openai, gemini, mistral
 *
 * Response (200):
 *   status       string              "ok" | "degraded" | "error" | "unconfigured"
 *   providers    ProviderCheck[]     One entry per checked provider
 *   timestamp    string              ISO-8601 UTC timestamp
 *
 * Each ProviderCheck:
 *   provider   string  Provider identifier (e.g. "openai")
 *   configured boolean Whether an API key is configured
 *   status     string  "ok" | "degraded" | "error" | "unconfigured"
 *   latencyMs  number  Round-trip latency in ms (null if not checked)
 *   detail     string  Human-readable detail
 *
 * Response (400):
 *   error   string  "invalid_provider"
 *   message string  Describes the supported providers
 */

import { NextRequest, NextResponse } from "next/server";
import {
  checkAiProviders,
  HealthCheckError,
  aggregateStatus,
} from "@/lib/health-checks";

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider")?.trim() || undefined;

  try {
    const providers = await checkAiProviders(provider);
    return NextResponse.json(
      {
        status: aggregateStatus(providers),
        providers,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  } catch (err) {
    if (err instanceof HealthCheckError) {
      return NextResponse.json(
        { error: "invalid_provider", message: err.message },
        { status: 400 }
      );
    }
    throw err;
  }
}
