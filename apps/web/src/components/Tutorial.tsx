"use client";

import { useEffect, useState } from "react";

export interface TutorialStep { title: string; body: string; }
export default function Tutorial({ id, title, steps }: { id: string; title: string; steps: TutorialStep[] }) {
  const key = `skystyle_tutorial_seen_${id}`;
  const [open, setOpen] = useState(false); const [step, setStep] = useState(0);
  useEffect(() => {
    try { if (!localStorage.getItem(key)) setOpen(true); } catch { /* unavailable storage */ }
    const replay = (event: Event) => { if ((event as CustomEvent<string>).detail === id) { setStep(0); setOpen(true); } };
    window.addEventListener("skystyle-replay-tutorial", replay); return () => window.removeEventListener("skystyle-replay-tutorial", replay);
  }, [id, key]);
  function close() { try { localStorage.setItem(key, "true"); } catch { /* unavailable storage */ } setOpen(false); }
  if (!open || !steps.length) return null;
  const current = steps[step];
  return <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${title} tutorial`}><button className="absolute inset-0 bg-black/50" aria-label="Close tutorial" onClick={close} /><div className="relative w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--card-border)" }}><p className="text-xs font-semibold uppercase tracking-widest opacity-50">{title} · {step + 1}/{steps.length}</p><h2 className="text-xl font-bold">{current.title}</h2><p className="text-sm leading-relaxed opacity-75">{current.body}</p><div className="flex justify-between gap-3 pt-2"><button className="text-sm underline" onClick={close}>Skip</button><button onClick={() => step + 1 < steps.length ? setStep(step + 1) : close()} className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>{step + 1 < steps.length ? "Next" : "Done"}</button></div></div></div>;
}
