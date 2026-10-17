"use client";
import { useEffect, useState } from "react";
import Dialog from "./Dialog";

type Period = { id: string; starts_at: string; ends_at: string; cancelled_at: string | null };
type PeriodData = { periods: Period[]; accountingEnabled: boolean };
export function parseProPeriodData(result: unknown): PeriodData {
  if (!result || typeof result !== "object" || !("periods" in result) || !("accountingEnabled" in result)
    || !Array.isArray(result.periods) || typeof result.accountingEnabled !== "boolean") throw new Error("Invalid period response.");
  const periods = result.periods.map((period: unknown): Period => {
    if (!period || typeof period !== "object" || !("id" in period) || !("starts_at" in period)
      || !("ends_at" in period) || !("cancelled_at" in period)
      || typeof period.id !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(period.id)
      || typeof period.starts_at !== "string" || typeof period.ends_at !== "string"
      || !Number.isFinite(Date.parse(period.starts_at)) || !Number.isFinite(Date.parse(period.ends_at))
      || Date.parse(period.ends_at) <= Date.parse(period.starts_at)
      || (period.cancelled_at !== null && (typeof period.cancelled_at !== "string" || !Number.isFinite(Date.parse(period.cancelled_at))))) throw new Error("Invalid period response.");
    return { id: period.id, starts_at: period.starts_at, ends_at: period.ends_at, cancelled_at: period.cancelled_at };
  });
  return { periods, accountingEnabled: result.accountingEnabled };
}
function message(data: unknown, fallback: string): string {
  return data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : fallback;
}

export default function ProPeriodManager({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [data, setData] = useState<PeriodData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const url = `/api/dev/users/${encodeURIComponent(userId)}/pro-periods`;
  useEffect(() => {
    const controller = new AbortController();
    void fetch(url, { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(message(result, "Unable to load periods."));
      setData(parseProPeriodData(result));
    }).catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load periods."); });
    return () => controller.abort();
  }, [url]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!startsAt.trim() || !endsAt.trim()) { setError("Enter both verified UTC timestamps."); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      const id = requestId ?? crypto.randomUUID();
      setRequestId(id);
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ periodId: id, startsAt, endsAt }) });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(message(result, "Period could not be saved."));
      setNotice("Period saved. No payment collected. V6 allowances only apply after the accounting rollout is activated.");
      const refreshed = await fetch(url, { cache: "no-store" });
      const next: unknown = await refreshed.json();
      if (!refreshed.ok) throw new Error(message(next, "Period saved, but refresh failed. Close and reopen to verify it."));
      const verified = parseProPeriodData(next);
      if (!verified.periods.some((period) => period.id === id)) throw new Error("Period saved, but it could not be verified. Close and reopen to check it.");
      setData(verified);
      setRequestId(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Period could not be saved."); }
    finally { setBusy(false); }
  }
  async function cancel(period: Period) {
    if (busy || !window.confirm("Cancel this period and archive its grant? Purchased credits are unaffected. No refund or payment is processed.")) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch(url, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ periodId: period.id }) });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(message(result, "Cancellation failed."));
      const refreshed = await fetch(url, { cache: "no-store" });
      const next: unknown = await refreshed.json();
      if (!refreshed.ok) throw new Error(message(next, "Cancellation saved, but refresh failed. Close and reopen to verify it."));
      const verified = parseProPeriodData(next);
      if (!verified.periods.some((row) => row.id === period.id && row.cancelled_at !== null)) throw new Error("Cancellation could not be verified. Close and reopen to check it.");
      setData(verified);
      setNotice("Period cancelled. Its grant is archived; no payment or refund was processed.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Cancellation failed."); }
    finally { setBusy(false); }
  }

  return <Dialog title="Admin-managed Pro periods" onClose={() => { if (!busy) onClose(); }}>
    <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-semibold">Pro subscription periods</h2><button type="button" onClick={onClose} disabled={busy} className="rounded-lg border px-3 py-1 text-sm" style={{ borderColor: "var(--card-border)" }}>Close</button></div>
    <p className="mt-3 text-sm opacity-70">Enter verified dates, not estimates. Each period is one UTC calendar month and grants 50 credits once; that grant expires at the period end. Checkout and automatic renewal are disabled.</p>
    <p className="mt-2 text-sm font-medium">{data ? data.accountingEnabled ? "V6 accounting is active." : "Staging only — V6 accounting is inactive; current account access is unchanged." : "Checking accounting status…"}</p>
    {error ? <p role="alert" className="mt-3 text-sm text-red-500">{error}</p> : null}
    {notice ? <p role="status" className="mt-3 text-sm">{notice}</p> : null}
    <form onSubmit={save} className="mt-5 space-y-3">
      <label className="block text-sm">Verified period start (UTC)<input value={startsAt} onChange={(event) => { setStartsAt(event.target.value); setRequestId(null); }} required placeholder="2026-09-29T00:00:00Z" disabled={busy} className="mt-1 block w-full rounded-lg border p-2" style={{ borderColor: "var(--card-border)", background: "var(--background)" }} /></label>
      <label className="block text-sm">Verified period end (UTC)<input value={endsAt} onChange={(event) => { setEndsAt(event.target.value); setRequestId(null); }} required placeholder="2026-10-29T00:00:00Z" disabled={busy} className="mt-1 block w-full rounded-lg border p-2" style={{ borderColor: "var(--card-border)", background: "var(--background)" }} /></label>
      <p className="text-xs opacity-60">Use a Z timestamp. Month-end dates clip to the last day of the following month. The same request ID is reused if a save needs retrying.</p>
      <button type="submit" disabled={busy || !data} className="rounded-lg px-4 py-2 text-sm disabled:opacity-50" style={{ background: "var(--accent)", color: "white" }}>{busy ? "Saving…" : "Save verified period"}</button>
    </form>
    <div className="mt-6 space-y-3"><h3 className="text-sm font-semibold">Recorded periods</h3>{data?.periods.length === 0 ? <p className="text-sm opacity-60">No dates recorded. Legacy Pro accounts need verified dates before V6 activation.</p> : null}{data?.periods.map((period) => <div key={period.id} className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--card-border)" }}><p>Start: {new Date(period.starts_at).toISOString()}</p><p>End: {new Date(period.ends_at).toISOString()}</p>{period.cancelled_at ? <p className="mt-2 opacity-60">Cancelled</p> : <button type="button" onClick={() => void cancel(period)} disabled={busy} className="mt-2 rounded border px-3 py-1">Cancel period</button>}</div>)}</div>
  </Dialog>;
}
