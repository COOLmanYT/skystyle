"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Choice = "keep" | "outfits" | "weather";
type Controls = "keep" | "guided" | "advanced";

export default function OnboardingClient({ userId, allowBrowserCompletionFallback }: { userId: string; allowBrowserCompletionFallback: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<Choice>("keep");
  const [controls, setControls] = useState<Controls>("keep");
  const [sound, setSound] = useState(false);
  const [saving, setSaving] = useState(false);
  const completionKey = `skystyle_onboarding_complete_${userId}`;

  useEffect(() => {
    try {
      if (allowBrowserCompletionFallback && localStorage.getItem(completionKey) && !new URLSearchParams(window.location.search).has("replay")) {
        router.replace("/dashboard");
      }
    } catch {
      // Storage can be disabled; the tour is still usable for this visit.
    }
  }, [allowBrowserCompletionFallback, completionKey, router]);

  async function finish() {
    if (saving) return;
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboarding: {
            complete: true,
            ...(controls === "guided" || controls === "advanced" ? { experienceMode: controls } : {}),
          },
        }),
      });
    } catch {
      // Local completion below still lets the user continue when the service is unavailable.
    }
    try {
      if (choice !== "keep") localStorage.setItem("skystyle_weather_only", String(choice === "weather"));
      if (controls !== "keep") localStorage.setItem("skystyle_simple_mode", String(controls === "guided"));
      localStorage.setItem(completionKey, "true");
      localStorage.setItem("skystyle_tutorial_seen_dashboard", "true");
    } catch {
      // The dashboard remains available when browser storage is blocked.
    }
    if (sound) {
      try {
        const audio = new AudioContext();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(660, audio.currentTime);
        oscillator.frequency.setValueAtTime(880, audio.currentTime + 0.12);
        gain.gain.setValueAtTime(0.05, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.3);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start();
        oscillator.stop(audio.currentTime + 0.3);
        oscillator.onended = () => void audio.close();
      } catch {
        // Sound is optional and should never block navigation.
      }
    }
    router.replace("/dashboard");
  }

  const optionClass = "block w-full rounded-xl border p-4 text-left text-sm transition-colors hover:border-[var(--accent)]";
  const optionStyle = (selected: boolean) => ({
    borderColor: selected ? "var(--accent)" : "var(--card-border)",
    background: selected ? "color-mix(in srgb, var(--accent) 9%, var(--card))" : "var(--card)",
  });

  return (
    <main id="main-content" className="min-h-screen px-4 py-8 sm:py-16" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest opacity-60">Sky Style setup · {step + 1} of 3</p>
          <h1 className="mt-2 text-3xl font-bold">{["Start with the basics", "Your first outfit", "Explore when you are ready"][step]}</h1>
        </div>
        <div className="flex gap-2" aria-label="Setup progress">
          {[0, 1, 2].map((index) => <div key={index} className="h-1.5 flex-1 rounded-full" style={{ background: index <= step ? "var(--accent)" : "var(--card-border)" }} />)}
        </div>
        <section className="space-y-4 rounded-2xl border p-5 sm:p-7" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          {step === 0 && <>
            <p className="text-sm opacity-75">Choose what Sky Style should show first. You can change this later on the dashboard.</p>
            {([
              ["keep", "Keep my current setup", "New accounts start with outfit advice."],
              ["outfits", "Outfit advice and weather", "Get an outfit suggestion for the weather at your chosen location."],
              ["weather", "Weather only", "See the forecast without generating an outfit."],
            ] as const).map(([value, title, description]) => <button key={value} type="button" onClick={() => setChoice(value)} className={optionClass} style={optionStyle(choice === value)} aria-pressed={choice === value}><span className="block font-semibold">{title}</span><span className="mt-1 block opacity-70">{description}</span></button>)}
          </>}
          {step === 1 && <>
            <p className="text-sm opacity-75">Your first recommendation takes three actions:</p>
            <ol className="list-inside list-decimal space-y-3 text-sm">
              <li>Enter a city or use your device location on the dashboard.</li>
              <li>Choose <strong>Fetch Weather &amp; Style</strong> to generate an outfit.</li>
              <li>Ask a follow-up to adjust the result.</li>
            </ol>
            <p className="text-sm opacity-75">Planning, closet, and custom weather sources are optional. You can make a first outfit without opening them.</p>
          </>}
          {step === 2 && <>
            <p className="text-sm opacity-75">Keep the guided dashboard or opt into the full set of controls. Sky Style saves the choice to your account when available and keeps a browser fallback.</p>
            {([
              ["keep", "Keep my current controls"],
              ["guided", "Guided controls"],
              ["advanced", "Full controls"],
            ] as const).map(([value, title]) => <button key={value} type="button" onClick={() => setControls(value)} className={optionClass} style={optionStyle(controls === value)} aria-pressed={controls === value}>{title}</button>)}
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={sound} onChange={(event) => setSound(event.target.checked)} />Play a short completion sound</label>
            <p className="text-xs opacity-60">You can reopen this guide from the Home menu.</p>
          </>}
        </section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" disabled={saving} onClick={() => void finish()} className="rounded-xl px-4 py-2 text-sm underline disabled:opacity-50">Skip setup</button>
          <div className="flex gap-2">
            {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="rounded-xl border px-4 py-2 text-sm" style={{ borderColor: "var(--card-border)" }}>Back</button>}
            <button type="button" disabled={saving} onClick={() => step < 2 ? setStep(step + 1) : void finish()} className="rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "#fff" }}>{saving ? "Saving…" : step < 2 ? "Next" : "Open dashboard"}</button>
          </div>
        </div>
      </div>
    </main>
  );
}
