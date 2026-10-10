"use client";
import { useCallback, useEffect, useState } from "react";
import type { HealthStatus, ProviderHealth } from "@/lib/health-checks";
interface Diagnostics {
  status: HealthStatus; servedAt: string; responseTimeMs: number; scope: string;
  services: Record<string, { status: HealthStatus; checkedAt: string; cached: boolean; providers: ProviderHealth[] }>;
  integrations: { microsoft: boolean; apple: boolean; shop: boolean; weather: Record<string, boolean> };
  scheduler?: {status:string;overdue?:number;stuck?:number;pendingDelivery?:number;httpFailures?:number;unanswered?:number};
  rollout: { status: string; enabled?: boolean; checkoutEnabled?: boolean };
}
const labels = { ok: "Reachable", degraded: "Needs attention", unconfigured: "Not configured" };
const colors = { ok: "#22863a", degraded: "#b45309", unconfigured: "var(--foreground)" };
export default function DevHealthPanel() {
  const [data, setData] = useState<Diagnostics | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const refresh = useCallback(async (signal?: AbortSignal) => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/dev/health", { cache: "no-store", signal });
      if (!response.ok) throw new Error(`Diagnostics unavailable (${response.status}).`);
      const result = await response.json() as Diagnostics;
      if (!result.services || !result.integrations || !result.rollout || !labels[result.status]) throw new Error("Diagnostics returned an incomplete response.");
      if (!signal?.aborted) setData(result);
    } catch (failure) { if (!signal?.aborted) setError(failure instanceof Error ? failure.message : "Unable to reach diagnostics."); }
    finally { if (!signal?.aborted) setBusy(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); queueMicrotask(() => { if (!controller.signal.aborted) void refresh(controller.signal); }); return () => controller.abort(); }, [refresh]);
  return <section className="space-y-5" aria-label="System health">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">System health</h2><p className="mt-1 text-sm opacity-65">Provider reachability and release readiness.</p></div><button disabled={busy} onClick={() => void refresh()} className="rounded-xl border px-4 py-2 text-sm disabled:opacity-50" style={{ borderColor: "var(--card-border)" }}>{busy ? "Checking…" : "Refresh diagnostics"}</button></div>
    {error && <p role="alert" className="rounded-xl border border-red-400 p-4 text-sm">{error} {data && "Showing the previous successful check."}</p>}
    {busy && !data && <p role="status" className="text-sm opacity-65">Checking services…</p>}
    {data && <><div role="status" className="rounded-2xl border p-5" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}><strong style={{ color: colors[data.status] }}>{labels[data.status]}</strong><p className="mt-2 text-xs opacity-65">Response {data.responseTimeMs} ms · refreshed {new Date(data.servedAt).toLocaleString()}. Probe timestamps below describe the measurements.</p></div>
      <div className="grid gap-4 md:grid-cols-3">{Object.entries(data.services).map(([category, service]) => <article key={category} className="rounded-2xl border p-5" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}><h3 className="font-semibold capitalize">{category}</h3><p className="mt-1 text-sm" style={{ color: colors[service.status] }}>{labels[service.status]}</p><p className="mt-2 text-xs opacity-60">Measured {new Date(service.checkedAt).toLocaleString()} · {service.cached ? "cached" : "fresh"}</p><ul className="mt-4 space-y-3">{service.providers.map((provider) => <li key={provider.provider} className="text-sm"><div className="flex justify-between gap-2"><span>{provider.provider}</span><span>{provider.latencyMs === null ? "—" : `${provider.latencyMs} ms`}</span></div><p className="text-xs opacity-65">{labels[provider.status]}</p></li>)}</ul></article>)}</div>
      <div className="grid gap-4 sm:grid-cols-2"><article className="rounded-2xl border p-5" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}><h3 className="font-semibold">Connections</h3><ul className="mt-3 space-y-2 text-sm">{[["Live Shop source", data.integrations.shop]].map(([name, ready]) => <li key={String(name)} className="flex justify-between gap-2"><span>{name}</span><span>{ready ? "Configured" : "Setup needed"}</span></li>)}</ul><p className="mt-3 text-xs opacity-60">Configuration does not confirm a successful product search.</p><p className="mt-3 text-xs opacity-60">Paid weather keys: {Object.entries(data.integrations.weather).filter(([, configured]) => configured).map(([provider]) => provider).join(", ") || "none configured"}. Not probed.</p></article>
      <article className="rounded-2xl border p-5" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}><h3 className="font-semibold">Rollout controls</h3><p className="mt-3 text-sm">{data.rollout.status === "verified" ? `V6 accounting: ${data.rollout.enabled ? "active" : "inactive"}. Checkout: ${data.rollout.checkoutEnabled ? "active" : "disabled"}.` : "Rollout state could not be verified."}</p><a href="/dev/operations" className="mt-4 inline-block text-sm underline">Open operations and user management</a></article></div>
      <article className="rounded-2xl border p-5" style={{borderColor:"var(--card-border)",background:"var(--card)"}}><h3 className="font-semibold">Automatic delivery</h3><p className="mt-2 text-sm">{!data.scheduler || data.scheduler.status==="unavailable" ? "Delivery diagnostics unavailable. Install the reviewed scheduler changes before rollout." : `Status: ${data.scheduler.status}. Overdue schedules: ${data.scheduler.overdue??0}; expired workers: ${data.scheduler.stuck??0}; pending inbox delivery: ${data.scheduler.pendingDelivery??0}; recent HTTP failures: ${data.scheduler.httpFailures??0}; unanswered calls: ${data.scheduler.unanswered??0}.`}</p></article>
      <p className="text-xs leading-relaxed opacity-60">{data.scope} Measurements are cached for up to five minutes. <a href="/api/v1/health" target="_blank" rel="noopener noreferrer" className="underline">Public health response ↗</a></p>
    </>}
  </section>;
}
