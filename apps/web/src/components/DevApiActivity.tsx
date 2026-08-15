"use client";

import { useCallback, useEffect, useState } from "react";

type ApiRequest = { id: string; endpoint: string; timestamp: string; status_code: number; response_time: number | null; request_method: string; error_code: string | null; error_message: string | null; request_input: unknown; response_output: unknown };
type ApiStats = Record<string, number | null>;

export default function DevApiActivity() {
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [stats, setStats] = useState<ApiStats>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/dev/api-usage");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(typeof data.error === "string" ? data.error : "Unable to load API activity.");
    else { setRequests(Array.isArray(data.requests) ? data.requests : []); setStats(data); setError(null); }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const cards = [["Requests (24h)", stats.totalRequests24h], ["Failures", stats.failedRequests24h], ["Error rate", stats.errorRate === null || stats.errorRate === undefined ? "—" : `${stats.errorRate}%`], ["Avg. response", stats.averageResponseMs === null || stats.averageResponseMs === undefined ? "—" : `${stats.averageResponseMs} ms`]];
  return <section className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>API Activity</h1><p className="mt-1 text-sm" style={{ color: "var(--foreground)", opacity: .58 }}>All captured API requests, including failures and redacted diagnostics.</p></div><button onClick={() => void load()} className="rounded-lg px-3 py-2 text-sm" style={{ border: "1px solid var(--card-border)", color: "var(--foreground)" }}>Refresh</button></div>
    {error && <p className="text-sm" style={{ color: "#ff453a" }}>{error}</p>}
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{cards.map(([label, value]) => <div key={String(label)} className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}><p className="text-xs" style={{ color: "var(--foreground)", opacity: .55 }}>{label}</p><p className="mt-1 text-xl font-bold" style={{ color: "var(--foreground)" }}>{String(value ?? "—")}</p></div>)}</div>
    <div className="overflow-auto rounded-xl" style={{ border: "1px solid var(--card-border)" }}><table className="w-full text-xs"><thead style={{ background: "var(--card)" }}><tr><th className="p-2 text-left">Time</th><th className="p-2 text-left">Request</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Error</th><th className="p-2 text-left">Diagnostics</th></tr></thead><tbody>{loading ? <tr><td className="p-3" colSpan={5}>Loading activity…</td></tr> : requests.length === 0 ? <tr><td className="p-3" colSpan={5}>No requests captured in the last 24 hours.</td></tr> : requests.map((request) => <tr key={request.id} style={{ borderTop: "1px solid var(--card-border)", color: "var(--foreground)" }}><td className="p-2 whitespace-nowrap">{new Date(request.timestamp).toLocaleString()}</td><td className="p-2">{request.request_method} {request.endpoint}</td><td className="p-2">{request.status_code} {request.response_time === null ? "" : `(${request.response_time}ms)`}</td><td className="p-2">{request.error_code || request.error_message || "—"}</td><td className="p-2"><details><summary className="cursor-pointer">View</summary><pre className="mt-1 max-w-96 whitespace-pre-wrap">{JSON.stringify({ input: request.request_input, output: request.response_output }, null, 2)}</pre></details></td></tr>)}</tbody></table></div>
  </section>;
}
