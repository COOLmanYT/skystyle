import { getSchedulerHealth } from "@/lib/scheduler-health";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDevEmails } from "@/lib/dev-auth";
import { aggregateHealth, aggregateServiceHealth, getCategoryHealth } from "@/lib/health-checks";
import { getOptionalOAuthReadiness } from "@/lib/oauth-readiness";
import { getEntitlementRollout } from "@/lib/entitlements";

/** Authenticated diagnostics reuse bounded probes and never expose raw errors. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!getDevEmails().has(session.user.email.toLowerCase())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const start = Date.now();
  const categories = ["database", "ai", "weather"] as const;
  const [entries, rollout, scheduler] = await Promise.all([
    Promise.all(categories.map(async (category) => {
      const result = await getCategoryHealth(category);
      return [category, { ...result, status: aggregateHealth(result.providers) }] as const;
    })),
    getEntitlementRollout().then((value) => ({ status: "verified" as const, ...value })).catch(() => ({ status: "unavailable" as const })),
    getSchedulerHealth(),
  ]);
  return NextResponse.json({
    status: aggregateServiceHealth(entries.map(([, result]) => result.status)),
    servedAt: new Date().toISOString(), responseTimeMs: Date.now() - start, services: Object.fromEntries(entries),
    integrations: { ...getOptionalOAuthReadiness(),
      shop: process.env.SHOP_SOURCE_APPROVED === "true" && Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET),
      weather: { openweather: Boolean(process.env.OPENWEATHER_API_KEY), weatherapi: Boolean(process.env.WEATHERAPI_KEY),
        visualcrossing: Boolean(process.env.VISUALCROSSING_API_KEY), pirateweather: Boolean(process.env.PIRATEWEATHER_API_KEY) },
    }, rollout, scheduler,
    scope: "Read-only connectivity. AI checks list models; weather checks Open-Meteo only. Paid weather configuration is shown without probing it. No generation, BYOK or checkout checks.",
  }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
