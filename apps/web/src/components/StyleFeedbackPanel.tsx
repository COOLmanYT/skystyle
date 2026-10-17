"use client";

import { useEffect, useRef, useState } from "react";
import Dialog from "./Dialog";
import { MAX_FEEDBACK_ADVICE, MAX_FEEDBACK_NOTE, MAX_FEEDBACK_SUMMARY, parseLocalStyleFeedback, styleFeedbackKey,
  withoutFeedbackEntry, type LocalStyleFeedback, type StyleVote } from "@/lib/style-feedback";

const ignoreSummary = () => {};

export default function StyleFeedbackPanel({ userId, hasRecommendation = false, recommendation = "",
  onSummaryChange = ignoreSummary, showVoting = true, compact = false }: {
  userId: string;
  hasRecommendation?: boolean;
  recommendation?: string;
  onSummaryChange?: (summary: string) => void;
  showVoting?: boolean;
  compact?: boolean;
}) {
  const [data, setData] = useState<LocalStyleFeedback>({ entries: [], summary: "" });
  const [mode, setMode] = useState<"local" | "cloud">("local");
  const [ready, setReady] = useState(false);
  const [cloudAvailable, setCloudAvailable] = useState(false);
  const [note, setNote] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [volatileStorage, setVolatileStorage] = useState(false);
  const revision = useRef(0);
  const cloudVersion = useRef<string | null>(null);
  const key = styleFeedbackKey(userId);
  const busy = !ready || saving;

  useEffect(() => {
    let active = true;
    async function load() {
      let loaded: LocalStyleFeedback = { entries: [], summary: "" };
      try { loaded = parseLocalStyleFeedback(localStorage.getItem(key)); }
      catch { if (active) { setVolatileStorage(true); setMessage("Browser storage is unavailable. Local feedback will last only on this page."); } }
      try {
        const response = await fetch("/api/style-feedback", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Cloud settings unavailable.");
        if (!active) return;
        setCloudAvailable(result.cloudAvailable === true);
        cloudVersion.current = result.updatedAt ?? null;
        if (result.storageMode === "cloud") {
          setMode("cloud");
          loaded = parseLocalStyleFeedback(JSON.stringify(result));
        }
      } catch {
        if (active) setMessage("Cloud settings could not be checked. Only device feedback is available; no cloud data was changed.");
      }
      if (active) {
        setData(loaded);
        onSummaryChange(loaded.summary);
        setReady(true);
      }
    }
    void load();
    return () => { active = false; revision.current += 1; };
  }, [key, onSummaryChange]);

  function writeLocal(next: LocalStyleFeedback) {
    if (next.entries.length === 0 && !next.summary) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(next));
  }

  async function cloudRequest(method: string, body?: unknown) {
    const payload = method === "PUT" ? { ...(body as LocalStyleFeedback), expectedUpdatedAt: cloudVersion.current } : body;
    const response = await fetch("/api/style-feedback", { method,
      headers: { "Content-Type": "application/json" }, body: payload === undefined ? undefined : JSON.stringify(payload) });
    const result = await response.json();
    if (method === "PUT" && typeof result.updatedAt === "string") cloudVersion.current = result.updatedAt;
    if (!response.ok) throw new Error(result.error || "Cloud feedback unavailable.");
    if (method === "PUT") cloudVersion.current = result.updatedAt ?? null;
    if (method === "PATCH" || method === "DELETE") cloudVersion.current = null;
  }

  async function persist(next: LocalStyleFeedback): Promise<boolean> {
    setSaving(true);
    try {
      if (mode === "cloud") await cloudRequest("PUT", next);
      else {
        try { writeLocal(next); }
        catch { setVolatileStorage(true); setMessage("Could not save on this device. Feedback will last only until you leave this page."); }
      }
      revision.current += 1;
      setData(next);
      onSummaryChange(next.summary);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed; your current feedback was kept.");
      return false;
    } finally { setSaving(false); }
  }

  async function changeStorage(nextMode: "local" | "cloud") {
    if (mode === nextMode) return;
    setSaving(true);
    try {
      let cleanupWarning = "";
      if (nextMode === "cloud") {
        await cloudRequest("PUT", data);
        onSummaryChange(data.summary);
        // Never remove the only copy before the server acknowledges the transfer.
        try { localStorage.removeItem(key); }
        catch { cleanupWarning = " This browser could not remove its old device copy; use Delete all to remove it."; }
      } else {
        const response = await fetch("/api/style-feedback", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load cloud feedback.");
        const latest = result.storageMode === "cloud" ? parseLocalStyleFeedback(JSON.stringify(result)) : data;
        writeLocal(latest); // Storage failure must leave cloud storage unchanged.
        await cloudRequest("PATCH", { storageMode: "local" });
        setData(latest);
        onSummaryChange(latest.summary);
      }
      revision.current += 1;
      setMode(nextMode);
      setMessage(`Feedback moved to ${nextMode === "cloud" ? "your private cloud account" : "this device; the cloud copy was removed"}.${cleanupWarning}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Storage switch failed. Your existing copy was kept.");
    } finally { setSaving(false); }
  }

  async function summarize(entries: LocalStyleFeedback["entries"]) {
    if (!entries.length) return;
    const currentRevision = revision.current;
    setSummarizing(true);
    try {
      const response = await fetch("/api/style-feedback/summary", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: entries.slice(-20).map(({ vote, note, advice }) => ({ vote, note, advice })) }) });
      const result = await response.json();
      if (!response.ok || typeof result.summary !== "string") throw new Error(result.error || "Summary unavailable.");
      if (revision.current === currentRevision && await persist({ entries, summary: result.summary.slice(0, MAX_FEEDBACK_SUMMARY) })) {
        setMessage("Preference summary updated. You can edit it below.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Summary unavailable. You can write it yourself.");
    } finally { setSummarizing(false); }
  }

  async function vote(value: StyleVote) {
    const entries = [...data.entries, { id: crypto.randomUUID(), vote: value,
      note: note.trim().slice(0, MAX_FEEDBACK_NOTE), advice: recommendation.slice(0, MAX_FEEDBACK_ADVICE), createdAt: new Date().toISOString() }];
    if (!await persist({ entries, summary: "" })) return;
    setNote("");
    setMessage("Feedback saved. Its text is sent to Mistral to update your preference summary.");
    void summarize(entries);
  }

  async function remove(id: string) {
    if (await persist(withoutFeedbackEntry(data, id))) {
      setMessage("Feedback deleted. The old summary was cleared so it cannot affect future advice.");
    }
  }

  async function clearAll() {
    setSaving(true);
    try {
      if (mode === "cloud") await cloudRequest("DELETE");
      let cleanupWarning = "";
      try { localStorage.removeItem(key); }
      catch { cleanupWarning = " Browser storage is unavailable; clear any older device copy in browser settings."; }
      revision.current += 1;
      setData({ entries: [], summary: "" });
      onSummaryChange("");
      setMessage(`Style feedback and its summary were deleted from ${mode === "cloud" ? "your cloud account and this page" : "this device and this page"}.${cleanupWarning}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Deletion failed. Please retry.");
    } finally { setSaving(false); }
  }

  const panel = (
    <section aria-label="Private style feedback" aria-busy={busy} className="space-y-3 rounded-xl border p-4"
      style={{ borderColor: "var(--card-border)", background: "var(--background)" }}>
      <div>
        <h3 className="text-sm font-semibold">Private style feedback</h3>
        <p className="mt-1 text-xs opacity-65">
          Local by default, with no automatic expiry. Cloud feedback is removed with your account.
          Local data must be deleted here or in each browser; browser cleanup can also remove it.
          Submitted notes, votes, and a short excerpt of the rated outfit go to Mistral Small for a summary and are never public.
        </p>
      </div>
      <label htmlFor="style-feedback-storage" className="block text-xs font-medium">Feedback storage</label>
      <select id="style-feedback-storage" value={mode} disabled={busy || summarizing}
        onChange={(event) => void changeStorage(event.target.value as "local" | "cloud")}
        className="rounded-lg border p-2 text-sm" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}>
        <option value="local">Local · this device</option>
        <option value="cloud" disabled={!cloudAvailable}>Cloud · my private account</option>
      </select>
      <p className="text-xs opacity-60">Changing storage moves the current feedback and summary. Cloud changes are shared across your devices; refresh before editing on another device.</p>
      {volatileStorage && mode === "local" && <p role="alert" className="text-xs">Device storage is unavailable. Your feedback is temporary on this page unless you move it to cloud storage.</p>}
      {modalOpen && <>
        <label htmlFor="style-feedback-note" className="block text-xs font-medium">{showVoting ? "Optional note about this outfit" : "Advice preference note"}</label>
        <textarea id="style-feedback-note" value={note} onChange={(event) => setNote(event.target.value)}
          maxLength={MAX_FEEDBACK_NOTE} rows={2} disabled={busy} placeholder="e.g. Keep the message shorter"
          className="w-full rounded-lg border p-2 text-sm" style={{ borderColor: "var(--card-border)", background: "var(--card)" }} />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void vote("up")} disabled={busy || summarizing || (showVoting ? !hasRecommendation : !note.trim())}
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50" style={{ borderColor: "var(--card-border)" }}>👍 Helpful</button>
          <button type="button" onClick={() => void vote("down")} disabled={busy || summarizing || (showVoting ? !hasRecommendation : !note.trim())}
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50" style={{ borderColor: "var(--card-border)" }}>👎 Not helpful</button>
        </div>
        {!hasRecommendation && <p className="text-xs opacity-60">{showVoting ? "Generate an outfit to rate it." : "Write a note about your advice preferences, then save a vote."} Saved preferences are included with your next recommendation.</p>}
      </>}
      <label htmlFor="style-feedback-summary" className="block text-xs font-medium">Your editable AI preference summary</label>
      <textarea id="style-feedback-summary" value={data.summary} disabled={busy}
        onChange={(event) => { revision.current += 1; setData({ ...data, summary: event.target.value.slice(0, MAX_FEEDBACK_SUMMARY) }); }}
        maxLength={MAX_FEEDBACK_SUMMARY} rows={2} placeholder="e.g. User would prefer a brief message"
        className="w-full rounded-lg border p-2 text-sm" style={{ borderColor: "var(--card-border)", background: "var(--card)" }} />
      <div className="flex flex-wrap gap-3 text-xs">
        <button type="button" disabled={busy} onClick={() => void persist(data).then((saved) => { if (saved) setMessage("Preference summary saved."); })} className="underline">Save summary</button>
        {data.entries.length > 0 && <button type="button" onClick={() => void summarize(data.entries)} disabled={busy || summarizing} className="underline">{summarizing ? "Summarizing…" : "Refresh summary"}</button>}
      </div>
      <p className="text-xs opacity-60">Save edits to use them with your next Style recommendation, follow-up or Shop search. Refresh summarizes your 20 most recent votes; older votes are retained until you delete them.</p>
      {data.entries.length > 0 && <div className="max-h-40 space-y-1 overflow-y-auto text-xs">
        {data.entries.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-2">
          <span>{entry.vote === "up" ? "👍" : "👎"} {entry.note || "No note"} · {new Date(entry.createdAt).toLocaleDateString()}</span>
          <button type="button" disabled={busy} onClick={() => void remove(entry.id)} aria-label={`Delete feedback: ${entry.note || entry.vote}`} className="underline">Delete</button>
        </div>)}
      </div>}
      {(data.entries.length > 0 || data.summary) && <button type="button" disabled={busy} onClick={() => void clearAll()} className="text-xs underline">Delete all style feedback</button>}
      {message && <p role="status" className="text-xs">{message}</p>}
    </section>
  );
  return <>
    {!compact && !modalOpen && panel}
    <button type="button" disabled={!ready} onClick={() => setModalOpen(true)} className="mt-3 rounded-xl border px-4 py-3 text-sm font-medium" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}>Record private style feedback</button>
    {modalOpen && <Dialog title="Record private style feedback" onClose={() => { if (!saving) setModalOpen(false); }}>
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Private style feedback</h2><button type="button" disabled={saving} onClick={() => setModalOpen(false)} aria-label="Close private feedback">✕</button></div>
      {panel}
    </Dialog>}
  </>;
}
