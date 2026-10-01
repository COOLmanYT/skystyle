import { NextRequest, NextResponse } from "next/server";
import { aggregateHealth, getCategoryHealth, HEALTH_PROVIDERS, type HealthCategory } from "./health-checks";
const headers = { "Cache-Control": "public, max-age=30, s-maxage=300", "X-Content-Type-Options": "nosniff" };
export async function categoryHealthResponse(category: HealthCategory, request?: NextRequest) {
  const start = Date.now();
  const provider = request?.nextUrl.searchParams.get("provider")?.trim().toLowerCase();
  if (provider && !(HEALTH_PROVIDERS[category] as readonly string[]).includes(provider)) return NextResponse.json({ error: "invalid_provider", supported: HEALTH_PROVIDERS[category] }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const result = await getCategoryHealth(category);
  const providers = provider ? result.providers.filter((entry) => entry.provider === provider) : result.providers;
  return NextResponse.json({ status: aggregateHealth(providers), providers, checkedAt: result.checkedAt, cached: result.cached, responseTimeMs: Date.now() - start,
    scope: category === "weather" ? "Open-Meteo reachability only; paid weather providers are not probed publicly." : category === "ai" ? "Hosted provider model-list reachability, not generation or BYOK availability." : "Read-only database connectivity." }, { headers });
}
export async function overallHealthResponse() {
  const start = Date.now();
  const categories = ["database", "ai", "weather"] as const;
  const results = await Promise.all(categories.map(async (category) => {
    const result = await getCategoryHealth(category);
    return [category, { status: aggregateHealth(result.providers), checkedAt: result.checkedAt,
      responseTime: Math.max(0, ...result.providers.map((provider) => provider.latencyMs ?? 0)) }] as const;
  }));
  return NextResponse.json({ status: results.some(([, result]) => result.status === "degraded") ? "degraded" : "ok", responseTime: Date.now() - start, services: Object.fromEntries(results) }, { headers });
}
