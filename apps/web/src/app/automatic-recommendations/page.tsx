"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageSpacingWrapper from "@/components/PageSpacingWrapper";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import useClothingInventory from "@/components/useClothingInventory";

interface Schedule { id: string; label: string; next_run_at: string; recurrence: "once" | "daily" | "weekly"; active: boolean }
interface Run { id: string; status: string; created_at: string; error: string | null; recommendation: { outfit?: string; reasoning?: string } | null }
const cardStyle = { background: "var(--card)", borderColor: "var(--card-border)" };

export default function AutomaticRecommendationsPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const inventory = useClothingInventory();

  const load = useCallback(async () => {
    const response = await fetch("/api/automatic-recommendations");
    if (!response.ok) throw new Error("Unable to load automatic recommendations. Please retry.");
    const data = await response.json();
    setSchedules(Array.isArray(data.schedules) ? data.schedules : []);
    setRuns(Array.isArray(data.runs) ? data.runs : []);
  }, []);
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { await load(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to load. Please retry."); }
    finally { setLoading(false); }
  }, [load]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function createSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    setBusy("create"); setError(null);
    try {
      const date = new Date(String(form.get("runAt")));
      if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) throw new Error("Choose a future date and time.");
      const response = await fetch("/api/automatic-recommendations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: form.get("label"), latitude: Number(form.get("latitude")), longitude: Number(form.get("longitude")),
          prompt: form.get("prompt"), recurrence: form.get("recurrence"), unitPreference: form.get("unitPreference"),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", runAt: date.toISOString(),
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(response.status === 401 ? "Sign in with a real account to save automatic recommendations. Your input is preserved." : data.error || "Unable to save schedule. Your input is preserved.");
      }
      element.reset();
      await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to save schedule. Your input is preserved; please retry."); }
    finally { setBusy(null); }
  }
  async function toggleSchedule(schedule: Schedule) {
    setBusy(schedule.id); setError(null);
    try {
      const response = await fetch("/api/automatic-recommendations", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: schedule.id, active: !schedule.active }),
      });
      if (!response.ok) throw new Error("Unable to update schedule. Please retry.");
      await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to update schedule. Please retry."); }
    finally { setBusy(null); }
  }

  const clothingLinks = !inventory.loading && !inventory.error;
  return <main className="min-h-screen px-4 py-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
    <PageSpacingWrapper page="automatic-recommendations" className="mx-auto max-w-3xl min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1"><h1 className="text-2xl font-bold">Automatic recommendations</h1>
          <p className="mt-2 text-sm opacity-70">Choose a location and time. Completed advice appears here and in your inbox; delivery can take a few minutes.</p></div>
        <Link href="/dashboard" className="control-button text-sm underline">Back to Style</Link>
      </div>
      {error && <div role="alert" className="text-sm"><p>{error}</p><button type="button" disabled={busy !== null || loading} onClick={() => void refresh()} className="control-button underline">Refresh schedules</button></div>}
      <form onSubmit={createSchedule} className="space-y-4 rounded-2xl border p-4 sm:p-5" style={cardStyle}>
        <h2 className="font-semibold">New schedule</h2>
        <fieldset disabled={busy !== null} className="min-w-0 space-y-4">
          <label className="block text-sm">Name<input required name="label" maxLength={80} placeholder="Morning commute" className="form-control mt-1" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Latitude<input required name="latitude" type="number" step="any" min="-90" max="90" placeholder="−37.8" className="form-control mt-1" /></label>
            <label className="text-sm">Longitude<input required name="longitude" type="number" step="any" min="-180" max="180" placeholder="145.0" className="form-control mt-1" /></label>
          </div>
          <label className="block text-sm">First run<input required name="runAt" type="datetime-local" className="form-control mt-1" /><span className="mt-1 block text-xs opacity-70">Uses your device timezone.</span></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Repeat<select name="recurrence" defaultValue="once" className="form-control mt-1"><option value="once">Once</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>
            <label className="text-sm">Units<select name="unitPreference" defaultValue="metric" className="form-control mt-1"><option value="metric">Metric</option><option value="imperial">Imperial</option></select></label>
          </div>
          <label className="block text-sm">Styling notes <span className="opacity-70">(optional)</span><textarea name="prompt" maxLength={1000} placeholder="Occasion, layers or footwear preferences" className="form-control mt-1" rows={3} /></label>
          <button className="control-button primary-button text-sm font-semibold">{busy === "create" ? "Saving…" : "Save schedule"}</button>
        </fieldset>
      </form>
      <section className="space-y-3" aria-label="Schedules"><h2 className="font-semibold">Schedules</h2>
        {loading ? <p role="status" className="text-sm">Loading schedules…</p> : !schedules.length ? !error && <p className="text-sm opacity-70">No schedules yet.</p> : schedules.map(schedule =>
          <div key={schedule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4" style={cardStyle}>
            <div className="min-w-0"><h3 className="break-words text-sm font-semibold">{schedule.label}</h3><p className="mt-1 text-xs opacity-70">{schedule.recurrence} · {schedule.active ? `next ${new Date(schedule.next_run_at).toLocaleString()}` : "paused"}</p></div>
            <button type="button" disabled={busy !== null} onClick={() => void toggleSchedule(schedule)} className="control-button text-sm underline">{busy === schedule.id ? "Updating…" : schedule.active ? "Pause" : "Resume"}</button>
          </div>)}
      </section>
      <section className="space-y-3"><h2 className="font-semibold">Recent results</h2>
        {!loading && !runs.length && <p className="text-sm opacity-70">Completed runs and delivery errors will appear here.</p>}
        {inventory.error && <p className="text-sm">{inventory.error} <button type="button" onClick={inventory.retry} className="control-button underline">Retry closet</button></p>}
        {runs.map(run => <article key={run.id} className="min-w-0 space-y-2 rounded-xl border p-4" style={cardStyle}>
          <p className="text-xs opacity-70">{run.status} · {new Date(run.created_at).toLocaleString()}</p>
          {run.error ? <p className="break-words text-sm">{run.error}</p> : run.recommendation?.outfit ? <>
            <MarkdownRenderer content={run.recommendation.outfit} className="text-sm" closetItems={inventory.items} wardrobeItems={inventory.wardrobeItems} recommendationLinks={clothingLinks} />
            {run.recommendation.reasoning && <MarkdownRenderer content={run.recommendation.reasoning} className="text-sm" closetItems={inventory.items} wardrobeItems={inventory.wardrobeItems} recommendationLinks={clothingLinks} />}
          </> : <p className="text-sm">{run.status === "completed" ? "Recommendation saved to your inbox." : "A completed recommendation is not available yet."}</p>}
        </article>)}
      </section>
    </PageSpacingWrapper>
  </main>;
}
