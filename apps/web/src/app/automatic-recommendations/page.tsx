"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageSpacingWrapper from "@/components/PageSpacingWrapper";

interface Schedule { id: string; label: string; next_run_at: string; recurrence: "once" | "daily" | "weekly"; active: boolean; }
interface Run { id: string; status: string; created_at: string; error: string | null; recommendation: { outfit?: string } | null; }

export default function AutomaticRecommendationsPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/automatic-recommendations");
    if (!res.ok) throw new Error("Unable to load automatic recommendations.");
    const data = await res.json();
    setSchedules(Array.isArray(data.schedules) ? data.schedules : []);
    setRuns(Array.isArray(data.runs) ? data.runs : []);
  }, []);
  useEffect(() => { load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load.")); }, [load]);

  async function createSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(null);
    const form = new FormData(event.currentTarget);
    const localRunAt = String(form.get("runAt"));
    const res = await fetch("/api/automatic-recommendations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      label: form.get("label"), latitude: Number(form.get("latitude")), longitude: Number(form.get("longitude")), prompt: form.get("prompt"), recurrence: form.get("recurrence"), unitPreference: form.get("unitPreference"), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, runAt: new Date(localRunAt).toISOString(),
    }) });
    setSaving(false);
    if (!res.ok) { const data = await res.json().catch(() => ({})); return setError(data.error ?? "Unable to save schedule."); }
    event.currentTarget.reset(); await load();
  }

  async function toggleSchedule(schedule: Schedule) {
    const res = await fetch("/api/automatic-recommendations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: schedule.id, active: !schedule.active }) });
    if (!res.ok) return setError("Unable to update schedule.");
    await load();
  }

  return <main className="min-h-screen px-4 py-8" style={{ background: "var(--background)", color: "var(--foreground)" }}><PageSpacingWrapper page="automatic-recommendations" className="max-w-3xl mx-auto space-y-6"><div className="flex justify-between gap-3"><div><h1 className="text-2xl font-bold">⏰ Automatic recommendations</h1><p className="text-sm opacity-60">Use a manual location and receive a saved outfit recommendation at the exact scheduled time.</p></div><Link href="/dashboard" className="text-sm rounded-xl px-3 py-2 h-fit" style={{ border: "1px solid var(--card-border)" }}>Back</Link></div>{error && <p role="alert" style={{ color: "#ff3b30" }}>{error}</p>}<form onSubmit={createSchedule} className="rounded-2xl p-5 space-y-3" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}><h2 className="font-semibold">New schedule</h2><input required name="label" placeholder="Morning commute" className="w-full rounded-xl px-3 py-2" style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}/><div className="grid grid-cols-2 gap-3"><input required name="latitude" type="number" step="any" min="-90" max="90" placeholder="Latitude" className="rounded-xl px-3 py-2" style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}/><input required name="longitude" type="number" step="any" min="-180" max="180" placeholder="Longitude" className="rounded-xl px-3 py-2" style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}/></div><input required name="runAt" type="datetime-local" className="w-full rounded-xl px-3 py-2" style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}/><select name="recurrence" defaultValue="once" className="rounded-xl px-3 py-2" style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}><option value="once">Once</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select><select name="unitPreference" defaultValue="metric" className="rounded-xl px-3 py-2 ml-2" style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}><option value="metric">Metric</option><option value="imperial">Imperial</option></select><textarea name="prompt" maxLength={1000} placeholder="Optional styling prompt" className="w-full rounded-xl px-3 py-2" rows={3} style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}/><button disabled={saving} className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>{saving ? "Saving…" : "Save schedule"}</button></form><section className="space-y-3"><h2 className="font-semibold">Schedules</h2>{schedules.length === 0 ? <p className="text-sm opacity-50">No schedules yet.</p> : schedules.map((schedule) => <div key={schedule.id} className="rounded-xl p-4 flex justify-between gap-3" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}><div><strong className="text-sm">{schedule.label}</strong><p className="text-xs opacity-55">{schedule.recurrence} · next {new Date(schedule.next_run_at).toLocaleString()}</p></div><button onClick={() => toggleSchedule(schedule)} className="text-xs underline">{schedule.active ? "Pause" : "Resume"}</button></div>)}</section><section className="space-y-3"><h2 className="font-semibold">Recent results</h2>{runs.map((run) => <article key={run.id} className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}><p className="text-xs opacity-55">{run.status} · {new Date(run.created_at).toLocaleString()}</p><p className="text-sm mt-1">{run.error ?? run.recommendation?.outfit ?? "Recommendation saved to your inbox."}</p></article>)}</section></PageSpacingWrapper></main>;
}
