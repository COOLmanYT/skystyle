"use client";
import { useState } from "react";
import Tutorial, { type TutorialStep } from "./Tutorial";
import useDashboardSections from "./useDashboardSections";
import { DASHBOARD_SECTION_OPTIONS, type DashboardSection, type DashboardSections } from "@/lib/dashboard-sections";
export default function DashboardOnboarding({ userId, startTour, persistenceAvailable, initialGuided, onSectionChange, onGuidedChange }: {
  userId: string; startTour: boolean; persistenceAvailable: boolean; initialGuided: boolean; onSectionChange: (section: DashboardSection) => void; onGuidedChange: (guided: boolean) => void;
}) {
  const { mode, setMode } = useDashboardSections(userId);
  const [guidedChoice, setGuidedChoice] = useState<boolean | null>(null), [storageWarning, setStorageWarning] = useState(false);
  const guided = guidedChoice ?? initialGuided;
  const [completionSound, setCompletionSound] = useState(false);
  const steps: TutorialStep[] = [
    { title: "Make Sky Style yours", body: "Choose outfit advice, shopping, or both. This choice stays in this browser for your account; change it any time in Settings.", content: <>
      <label className="block text-sm font-medium" htmlFor="onboarding-sections">Dashboard sections</label>
      <select id="onboarding-sections" value={mode} onChange={(event) => setStorageWarning(!setMode(event.target.value as DashboardSections))}
        className="mt-2 w-full rounded-xl border p-3" style={{ background: "var(--background)", borderColor: "var(--card-border)" }}>
        {DASHBOARD_SECTION_OPTIONS.map((option) => <option key={option} value={option}>{option === "both" ? "Style and Shop" : `${option === "style" ? "Style" : "Shop"} only`}</option>)}
      </select>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={guided} onChange={(event) => { setGuidedChoice(event.target.checked); onGuidedChange(event.target.checked); }} />Start with guided controls</label>
      <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={completionSound} onChange={(event) => setCompletionSound(event.target.checked)} />Play an optional completion sound</label>
      {storageWarning && <p role="status" className="mt-2 text-xs">Storage is disabled. This section choice lasts only for this visit.</p>}
      {!persistenceAvailable && <p className="mt-2 text-xs opacity-70">Account completion is unavailable. A browser fallback is used when possible; setup may repeat if browser storage is disabled.</p>}
    </> },
    { title: "Two workspaces, one app", body: "Style builds advice around your weather and wardrobe. Shop finds new clothes. Your menu shows the same enabled sections.", target: '[data-tour="sections"]' },
    ...(mode !== "shop" ? [
      { title: "First: choose your location", body: "After this tour, enter a city or choose device location. GPS is optional and asks permission first.", target: '[data-tour="location"]' },
      { title: "Next: tell us about your day", body: "Choose an occasion, date and fragrance if useful. Shopping budgets belong in Shop.", target: '[data-tour="style-preferences"]' },
      { title: "Get your first outfit", body: "Choose Fetch Weather & Style. Your forecast arrives first, then your outfit. When it is ready, ask a follow-up to change an item or shorten the answer.", target: '[data-tour="generate-style"]' },
    ] : []),
    ...(mode !== "style" ? [{ title: "Find something new", body: "Describe clothes you want, set a budget and size, then search. AI ranks sourced candidates; missing prices, ratings and images are labelled. Checkout happens at the retailer.", target: '[data-tour="shop-config"]' }] : []),
    { title: "Ready to start", body: "Settings has replay, appearance controls, and private feedback. This tour never generates or charges for a recommendation." },
  ];
  function stepChange(index: number) {
    const target = steps[index]?.target;
    if (target === '[data-tour="shop-config"]') onSectionChange("shop");
    else if (target?.includes("style") || target?.includes("location")) onSectionChange("style");
  }
  async function complete() {
    let response: Response | undefined;
    try { response = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboarding: { complete: true, experienceMode: guided ? "guided" : "advanced" } }) }); }
    catch { if (persistenceAvailable) throw new Error("Save failed"); }
    if (response && !response.ok && (persistenceAvailable || response.status < 500)) throw new Error("Save failed");
    try { localStorage.setItem(`skystyle_onboarding_complete_${userId}`, "true"); localStorage.setItem("skystyle_simple_mode", String(guided)); } catch { /* cloud completion still works */ }
    onGuidedChange(guided);
    const url = new URL(window.location.href); url.searchParams.delete("tour"); url.searchParams.delete("replay");
    window.history.replaceState(null, "", url);
    onSectionChange(mode === "shop" ? "shop" : "style");
    window.scrollTo({ top: 0, behavior: "instant" });
    if (completionSound) {
      try {
        const audio = new AudioContext(), oscillator = audio.createOscillator(), gain = audio.createGain();
        oscillator.connect(gain); gain.connect(audio.destination); oscillator.frequency.value = 660;
        gain.gain.setValueAtTime(0.04, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.15);
        oscillator.start(); oscillator.stop(audio.currentTime + 0.15); oscillator.onended = () => void audio.close();
      } catch { /* Audio support is optional; never block onboarding. */ }
    }
  }
  return <Tutorial id={`dashboard_${userId}`} title="Getting started" steps={steps} autoOpen={false} forceOpen={startTour}
    completionFallbackKey={persistenceAvailable ? undefined : `skystyle_onboarding_complete_${userId}`} onStepChange={stepChange} onComplete={complete} />;
}
