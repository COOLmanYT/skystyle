"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Dialog from "./Dialog";
export interface TutorialStep { title: string; body: string; target?: string; content?: ReactNode; }
export function shouldOpenTutorial(forceOpen: boolean, autoOpen: boolean, seen: boolean, allowBrowserFallback = false, replayRequested = false): boolean {
  // Healthy account state outranks browser history. Use the account-scoped
  // browser completion marker only when durable settings are unavailable.
  return forceOpen ? !allowBrowserFallback || replayRequested || !seen : autoOpen && !seen;
}
export default function Tutorial({ id, title, steps, forceOpen = false, autoOpen = true, completionFallbackKey, onComplete, onStepChange }: {
  id: string; title: string; steps: TutorialStep[]; forceOpen?: boolean; autoOpen?: boolean;
  completionFallbackKey?: string;
  onComplete?: () => Promise<void> | void; onStepChange?: (step: number) => void;
}) {
  const key = `skystyle_tutorial_seen_${id}`;
  const [open, setOpen] = useState(false), [step, setStep] = useState(0);
  const stepCallback = useRef(onStepChange);
  useEffect(() => { stepCallback.current = onStepChange; }, [onStepChange]);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const current = steps[Math.min(step, steps.length - 1)];
  useEffect(() => {
    const replayRequested = new URLSearchParams(window.location.search).get("replay") === "1";
    try { if (shouldOpenTutorial(forceOpen, autoOpen, Boolean(localStorage.getItem(completionFallbackKey ?? key)), Boolean(completionFallbackKey), replayRequested)) queueMicrotask(() => setOpen(true)); }
    catch { if (shouldOpenTutorial(forceOpen, autoOpen, false, Boolean(completionFallbackKey), replayRequested)) queueMicrotask(() => setOpen(true)); }
    const replay = (event: Event) => { if ((event as CustomEvent<string>).detail === id) { setStep(0); setOpen(true); } };
    window.addEventListener("skystyle-replay-tutorial", replay);
    return () => window.removeEventListener("skystyle-replay-tutorial", replay);
  }, [id, key, forceOpen, autoOpen, completionFallbackKey]);
  useEffect(() => {
    if (!open) return;
    stepCallback.current?.(step);
    let target: HTMLElement | null = null;
    const measure = () => {
      const bounds = target?.getBoundingClientRect();
      setRect(bounds && bounds.width > 0 ? { top: bounds.top, left: bounds.left, width: bounds.width, height: bounds.height } : null);
    };
    const frame = requestAnimationFrame(() => {
      target = current?.target ? document.querySelector<HTMLElement>(current.target) : null;
      target?.scrollIntoView({ block: "start", behavior: "instant" });
      if (target) window.scrollBy({ top: target.getBoundingClientRect().top - 88, behavior: "instant" });
      measure();
    });
    window.addEventListener("resize", measure); window.addEventListener("scroll", measure, true);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [open, step, current?.target]);
  async function close() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await onComplete?.();
      try { localStorage.setItem(key, "true"); } catch { /* browser fallback is optional */ }
      setOpen(false);
    } catch { setError("Could not save setup. Please retry; your choices are still on this page."); }
    finally { setBusy(false); }
  }
  if (!open || !current) return null;
  return <Dialog title={`${title} tutorial`} onClose={() => void close()} spotlight={Boolean(rect)} decoration={rect && <div aria-hidden="true" className="pointer-events-none fixed rounded-2xl border-4 border-white ring-4 ring-blue-500"
    style={{ top: Math.max(4, rect.top - 4), left: Math.max(4, rect.left - 4), width: Math.min(rect.width + 8, window.innerWidth - 8), height: Math.min(rect.height + 8, window.innerHeight - 8), boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)" }} />}>
    <p className="text-xs font-semibold uppercase tracking-widest opacity-60">{title} · {Math.min(step + 1, steps.length)}/{steps.length}</p>
    <h2 className="mt-3 text-2xl font-semibold">{current.title}</h2>
    <p className="mt-3 text-sm leading-relaxed opacity-75">{current.body}</p>
    {current.content && <div className="mt-4">{current.content}</div>}
    {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
    <div className="mt-6 flex items-center justify-between gap-3">
      <button disabled={busy} className="text-sm underline" onClick={() => void close()}>Skip tour</button>
      <div className="flex gap-2">
        {step > 0 && <button disabled={busy} className="rounded-xl border px-4 py-2 text-sm" onClick={() => setStep(step - 1)}>Back</button>}
        <button disabled={busy} onClick={() => step + 1 < steps.length ? setStep(step + 1) : void close()}
          className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>{busy ? "Saving…" : step + 1 < steps.length ? "Next" : "Start using Sky Style"}</button>
      </div>
    </div>
  </Dialog>;
}
