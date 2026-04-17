export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";
import { API_DASHBOARD_ENDPOINTS, normalizeApiUsageEndpoint } from "@/lib/api-key-credits";

type DashboardEndpoint = (typeof API_DASHBOARD_ENDPOINTS)[number];
const LOOKBACK_HOURS = 24;
const BUCKET_COUNT = 24;
const FIRST_BUCKET_OFFSET_HOURS = LOOKBACK_HOURS - 1;
const ONE_HOUR_MS = 60 * 60 * 1000;

function buildHourlyBuckets(nowMs: number): Array<{ startMs: number; label: string; count: number }> {
  const bucketStartTime = new Date(nowMs - FIRST_BUCKET_OFFSET_HOURS * ONE_HOUR_MS);
  bucketStartTime.setMinutes(0, 0, 0);
  const buckets: Array<{ startMs: number; label: string; count: number }> = [];
  for (let i = 0; i < BUCKET_COUNT; i += 1) {
    const startMs = bucketStartTime.getTime() + i * ONE_HOUR_MS;
    const label = new Date(startMs).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    buckets.push({ startMs, label, count: 0 });
  }
  return buckets;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncPublicUser(session);

  const { data: keyRows, error: keyError } = await supabaseAdmin
    .from("api_keys")
    .select("id")
    .eq("user_id", session.user.id);

  if (keyError) {
    return NextResponse.json({ error: "Failed to load API keys" }, { status: 500 });
  }

  const apiKeyIds = (keyRows ?? [])
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const emptyCounts = API_DASHBOARD_ENDPOINTS.reduce<Record<DashboardEndpoint, number>>((acc, endpoint) => {
    acc[endpoint] = 0;
    return acc;
  }, {} as Record<DashboardEndpoint, number>);

  const nowMs = Date.now();
  const sinceIso = new Date(nowMs - LOOKBACK_HOURS * ONE_HOUR_MS).toISOString();
  const buckets = buildHourlyBuckets(nowMs);

  if (apiKeyIds.length === 0) {
    return NextResponse.json({
      totalRequests24h: 0,
      endpointCounts: emptyCounts,
      requestsOverTime: buckets.map(({ label, count }) => ({ label, count })),
      errorRate: null,
      avgResponseTimeMs: null,
    });
  }

  const { data: usageRows, error: usageError } = await supabaseAdmin
    .from("api_usage_logs")
    .select("endpoint, timestamp, status_code, response_time")
    .in("api_key_id", apiKeyIds)
    .gte("timestamp", sinceIso);

  if (usageError) {
    return NextResponse.json({ error: "Failed to load API usage" }, { status: 500 });
  }

  const rows = usageRows ?? [];
  const endpointCounts = { ...emptyCounts };
  let errorCount = 0;
  let sumResponseTime = 0;
  let responseTimeCount = 0;

  for (const row of rows) {
    const normalized = normalizeApiUsageEndpoint(typeof row.endpoint === "string" ? row.endpoint : "");
    if (normalized in endpointCounts) {
      endpointCounts[normalized as DashboardEndpoint] += 1;
    }

    const timestampMs = typeof row.timestamp === "string" ? Date.parse(row.timestamp) : Number.NaN;
    if (Number.isFinite(timestampMs)) {
      const bucketIndex = Math.floor((timestampMs - buckets[0].startMs) / ONE_HOUR_MS);
      if (bucketIndex >= 0 && bucketIndex < buckets.length) {
        buckets[bucketIndex].count += 1;
      }
    }

    const statusCode = typeof row.status_code === "number" ? row.status_code : 0;
    if (statusCode >= 400) errorCount += 1;

    const responseTime = typeof row.response_time === "number" ? row.response_time : null;
    if (responseTime !== null && responseTime >= 0) {
      sumResponseTime += responseTime;
      responseTimeCount += 1;
    }
  }

  const errorRate = rows.length > 0 ? Math.round((errorCount / rows.length) * 1000) / 10 : null;
  const avgResponseTimeMs = responseTimeCount > 0 ? Math.round(sumResponseTime / responseTimeCount) : null;

  return NextResponse.json({
    totalRequests24h: rows.length,
    endpointCounts,
    requestsOverTime: buckets.map(({ label, count }) => ({ label, count })),
    errorRate,
    avgResponseTimeMs,
  });
}
