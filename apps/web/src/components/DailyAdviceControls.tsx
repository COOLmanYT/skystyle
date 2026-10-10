"use client";
import { useEffect, useState } from "react";
import { DEFAULT_COMFORT, dailyWindowError, parseComfort, type ComfortPreferences } from "@/lib/comfort";
import type { RecommendationContext } from "@/lib/recommendation-context";
import { DEMO_USER_ID } from "@/lib/demo";
export default function DailyAdviceControls({ userId, onChange, onValidationChange }: { userId: string; onChange: (value: Pick<RecommendationContext, "window" | "comfort">) => void; onValidationChange?: (message: string) => void }) {
  const [comfort, setComfort] = useState(DEFAULT_COMFORT), [mode, setMode] = useState<"cloud" | "local">("cloud");
  const [start, setStart] = useState(""), [end, setEnd] = useState(""), [useWindow, setUseWindow] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const key = `skystyle_comfort_${userId}`;
  const pendingKey = `skystyle_comfort_pending_${userId}`;
  useEffect(() => {
    let current = true;
    async function load() {
      try {
        const local = localStorage.getItem(key);
        if (local) {
          const value = parseComfort(JSON.parse(local)), pending = localStorage.getItem(pendingKey);
          if (current) { setMode(pending ? "cloud" : "local"); setComfort(value); if (pending) setMessage("Cloud removal is unfinished. Switch to device only again to retry."); }
          return;
        }
      } catch { if (current) setMessage("Device preferences could not be read. Check cloud settings before saving."); }
      if (userId === DEMO_USER_ID) { if (current) setMode("local"); return; }
      try {
        const response = await fetch("/api/settings"); if (!response.ok) throw new Error();
        const data = await response.json(); if (current && data.comfort_preferences) setComfort(parseComfort(data.comfort_preferences));
      } catch { if (current) setMessage("Preferences could not be loaded. Your edits can still be retried."); }
    }
    void load(); return () => { current = false; };
  }, [key, pendingKey, userId]);
  const windowError = dailyWindowError(useWindow, start, end);
  useEffect(() => {
    onValidationChange?.(windowError);
    const window = !windowError && useWindow && start && end && Number.isFinite(Date.parse(start)) && Number.isFinite(Date.parse(end)) ? { start: new Date(start).toISOString(), end: new Date(end).toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" } : undefined;
    onChange({ comfort, ...(window ? { window } : {}) });
  }, [comfort, start, end, useWindow, windowError, onChange, onValidationChange]);
  async function save(nextMode = mode) {
    setBusy(true); setMessage("");
    try {
      if (nextMode === "local") {
        // Keep a retryable local copy until the server confirms removal.
        localStorage.setItem(key, JSON.stringify(comfort));
        if (userId !== DEMO_USER_ID) {
          localStorage.setItem(pendingKey,"true");
          const response = await fetch("/api/settings", {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({comfortPreferences:null})});
          if(!response.ok) throw new Error("Your device copy is saved, but cloud removal failed. Retry to finish switching.");
        }
      } else {
        const response = await fetch("/api/settings", {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({comfortPreferences:comfort})});
        if(!response.ok) throw new Error("Could not save preferences. Your input is preserved.");
        localStorage.removeItem(key);
      }
      localStorage.removeItem(pendingKey);
      setMode(nextMode); setMessage(nextMode === "local" ? "Saved on this device; no cloud copy." : "Saved across your devices.");
    } catch(failure) { setMessage(failure instanceof Error ? failure.message : "Storage is unavailable. Please retry."); }
    finally { setBusy(false); }
  }
  async function clear() {
    setBusy(true);setMessage("");
    try {
      if(userId!==DEMO_USER_ID){const response=await fetch("/api/settings",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({comfortPreferences:null})});if(!response.ok)throw new Error("Could not remove the cloud copy. Your controls are preserved; retry to finish.");}
      localStorage.removeItem(key);localStorage.removeItem(pendingKey);setComfort(DEFAULT_COMFORT);setMessage("Saved comfort preferences removed from this account and device.");
    }catch(failure){setMessage(failure instanceof Error?failure.message:"Could not clear preferences. Please retry.");}finally{setBusy(false);}
  }
  const field = "form-control mt-1", style = {background:"var(--background)",borderColor:"var(--card-border)"};
  function update(key: keyof ComfortPreferences, value: string) { setComfort(previous => ({...previous,[key]:value})); }
  return <details className="daily-controls rounded-xl border p-4 sm:col-span-2" style={{borderColor:"var(--card-border)"}}><summary className="cursor-pointer text-sm font-medium">Your day & comfort</summary>
    <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={useWindow} onChange={e=>setUseWindow(e.target.checked)} />Plan across a time window</label>
    {useWindow && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label>Start<input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} className={field} style={style}/></label><label>End<input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)} className={field} style={style}/></label><p className="text-xs opacity-65 sm:col-span-2">Use your device timezone. Choose up to 24 hours and clear the single event time. Uncovered forecast hours are labelled.</p></div>}
    <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">Temperature preference<select value={comfort.temperature} onChange={e=>update("temperature",e.target.value)} className={field} style={style}><option value="neutral">Neutral</option><option value="cold">I run cold</option><option value="warm">I run warm</option></select></label>
      {([['fabricDislikes','Fabric dislikes'],['coverage','Coverage preferences'],['footwearRestrictions','Footwear restrictions'],['dressCode','Dress code']] as const).map(([key,label])=><label key={key} className="text-sm">{label}<input maxLength={200} value={comfort[key]} onChange={e=>update(key,e.target.value)} className={field} style={style}/></label>)}
    </div><div className="mt-3 flex flex-wrap items-center gap-3 text-xs"><span>{mode === "cloud" ? "Sync across devices" : "Device only"}</span><button type="button" disabled={busy} onClick={()=>void save()} className="control-button underline">{busy ? "Saving…" : "Save preferences"}</button>
      <button type="button" disabled={busy || userId === DEMO_USER_ID} onClick={()=>{ const next=mode === "cloud" ? "local" : "cloud"; if(next === "cloud" || window.confirm("Remove your cloud comfort settings and keep a copy on this device?")) void save(next); }} className="control-button underline">Switch to {mode === "cloud" ? "device only" : "cloud sync"}</button>
      <button type="button" disabled={busy} onClick={()=>{ setComfort(DEFAULT_COMFORT); }} className="control-button underline">Reset comfort</button><button type="button" disabled={busy} onClick={()=>void clear()} className="control-button underline">Delete saved preferences</button></div>
    {windowError && <p role="alert" className="mt-2 text-sm">{windowError}</p>}
    {message && <p role="status" className="mt-2 text-xs">{message}</p>}
  </details>;
}
