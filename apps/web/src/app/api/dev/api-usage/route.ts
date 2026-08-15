export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDevEmails } from "@/lib/dev-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !getDevEmails().has(session.user.email.toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("api_usage_logs")
    .select("id, api_key_id, endpoint, timestamp, response_time, status_code, request_method, request_input, response_output, error_code, error_message")
    .gte("timestamp", since)
    .order("timestamp", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const failures = rows.filter((row) => row.status_code >= 400).length;
  const timed = rows.filter((row) => typeof row.response_time === "number");
  const averageResponseMs = timed.length
    ? Math.round(timed.reduce((sum, row) => sum + (row.response_time ?? 0), 0) / timed.length)
    : null;
  return NextResponse.json({
    totalRequests24h: rows.length,
    failedRequests24h: failures,
    errorRate: rows.length ? Math.round((failures / rows.length) * 1000) / 10 : 0,
    averageResponseMs,
    requests: rows,
  });
}
