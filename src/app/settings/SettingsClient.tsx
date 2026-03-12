"use client";

import { useState } from "react";
import Link from "next/link";

const MAX_GENDER_LENGTH = 30;

function isGenderActive(option: string, gender: string): boolean {
  return (option === "Other" && gender === "N/A") || gender === option;
}

function getLocalStorage(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

type LayoutMode = "symmetric" | "large-weather" | "large-settings";
const LAYOUT_OPTIONS: { value: LayoutMode; label: string; desc: string }[] = [
  { value: "symmetric",      label: "Symmetrical Split",  desc: "Both panels are equal width" },
  { value: "large-weather",  label: "Large Weather",      desc: "Weather panel is wider (default)" },
  { value: "large-settings", label: "Large Settings",     desc: "Settings panel is wider" },
];

interface SettingsClientProps {
  initialUnitPreference: "metric" | "imperial";
}

export default function SettingsClient({ initialUnitPreference }: SettingsClientProps) {
  const [gender, setGender] = useState<string>(() => getLocalStorage("skystyle_gender", "N/A"));
  const [customGender, setCustomGender] = useState(() => getLocalStorage("skystyle_custom_gender", ""));
  const [unitPreference, setUnitPreference] = useState<"metric" | "imperial">(initialUnitPreference);
  const [shareLocation, setShareLocation] = useState(() => getLocalStorage("skystyle_location_consent", "false") === "true");
  const [weatherOnly, setWeatherOnly] = useState(() => getLocalStorage("skystyle_weather_only", "false") === "true");

  // Layout settings
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(
    () => (getLocalStorage("skystyle_layout_mode", "large-weather") as LayoutMode)
  );
  const [extraSpacing, setExtraSpacing] = useState(
    () => getLocalStorage("skystyle_extra_spacing", "false") === "true"
  );
  const [extraSpacingPages, setExtraSpacingPages] = useState<string[]>(
    () => getLocalStorage("skystyle_extra_spacing_pages", "dashboard").split(",").filter(Boolean)
  );
  const [customSpacing, setCustomSpacing] = useState(
    () => getLocalStorage("skystyle_custom_spacing", "false") === "true"
  );

  // Apply extra spacing on this page immediately
  const settingsExtraSpacing = extraSpacing && extraSpacingPages.includes("settings");

  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // Reflect extra-spacing toggles instantly (before saving) so user sees live preview

  function toggleExtraSpacingPage(page: string) {
    setExtraSpacingPages((prev) =>
      prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page]
    );
  }

  function saveToLocalStorage() {
    try {
      localStorage.setItem("skystyle_gender", gender);
      localStorage.setItem("skystyle_custom_gender", customGender);
      localStorage.setItem("skystyle_location_consent", String(shareLocation));
      localStorage.setItem("skystyle_weather_only", String(weatherOnly));
      localStorage.setItem("skystyle_layout_mode", layoutMode);
      localStorage.setItem("skystyle_extra_spacing", String(extraSpacing));
      localStorage.setItem("skystyle_extra_spacing_pages", extraSpacingPages.join(","));
      localStorage.setItem("skystyle_custom_spacing", String(customSpacing));
      window.dispatchEvent(new Event("skystyle-preferences-updated"));
    } catch { /* ignore */ }
  }

  async function handleSave() {
    saveToLocalStorage();
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit_preference: unitPreference }),
      });
    } catch { /* ignore */ }
    setSavedMessage("Settings saved!");
    setTimeout(() => setSavedMessage(null), 2500);
  }

  const layoutIndex = LAYOUT_OPTIONS.findIndex((o) => o.value === layoutMode);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Navigation */}
      <nav
        className="sticky-nav px-4 py-3"
        style={{ borderBottom: "1px solid var(--card-border)" }}
      >
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm btn-interact rounded-xl px-3 py-2"
              style={{ color: "var(--foreground)", opacity: 0.6 }}
            >
              ← Dashboard
            </Link>
            <span className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              ⚙️ Settings
            </span>
          </div>
          <button
            onClick={handleSave}
            className="rounded-xl px-4 py-2 text-sm font-medium btn-interact"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Save
          </button>
        </div>
      </nav>

      {/* Content */}
      <div
        className="max-w-2xl mx-auto py-8 space-y-6"
        style={{
          paddingLeft: settingsExtraSpacing ? 48 : 16,
          paddingRight: settingsExtraSpacing ? 48 : 16,
        }}
      >
        {savedMessage && (
          <div
            className="rounded-2xl p-4 text-sm text-center font-medium"
            style={{
              background: "#34c75915",
              border: "1px solid #34c75940",
              color: "#34c759",
            }}
          >
            ✅ {savedMessage}
          </div>
        )}

        {/* Gender */}
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--foreground)", opacity: 0.4 }}>
            Gender (for outfit recommendations)
          </p>
          <div className="flex flex-wrap gap-2">
            {["Male", "Female", "Other", "Other - Manual"].map((opt) => (
              <button
                key={opt}
                onClick={() => setGender(opt === "Other" ? "N/A" : opt)}
                className="rounded-xl px-3 py-1.5 text-xs font-medium btn-interact"
                style={{
                  background: isGenderActive(opt, gender) ? "var(--accent)" : "var(--background)",
                  color: isGenderActive(opt, gender) ? "#fff" : "var(--foreground)",
                  border: "1px solid var(--card-border)",
                }}
              >
                {opt}
              </button>
            ))}
          </div>
          {gender === "Other - Manual" && (
            <input
              type="text"
              value={customGender}
              onChange={(e) => setCustomGender(e.target.value.slice(0, MAX_GENDER_LENGTH))}
              placeholder={`Type your gender (max ${MAX_GENDER_LENGTH} chars)`}
              maxLength={MAX_GENDER_LENGTH}
              className="mt-2 w-full rounded-xl px-3 py-2 text-xs outline-none"
              style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--card-border)" }}
            />
          )}
        </div>

        {/* Units */}
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--foreground)", opacity: 0.4 }}>
            Units
          </p>
          <div className="flex gap-2">
            {(["metric", "imperial"] as const).map((unit) => (
              <button
                key={unit}
                onClick={() => setUnitPreference(unit)}
                className="rounded-xl px-3 py-1.5 text-xs font-medium btn-interact capitalize"
                style={{
                  background: unitPreference === unit ? "var(--accent)" : "var(--background)",
                  color: unitPreference === unit ? "#fff" : "var(--foreground)",
                  border: "1px solid var(--card-border)",
                }}
              >
                {unit === "metric" ? "°C / km/h" : "°F / mph"}
              </button>
            ))}
          </div>
        </div>

        {/* Preferences */}
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>
            Preferences
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={shareLocation} onChange={(e) => setShareLocation(e.target.checked)} className="rounded" />
            <span className="text-xs" style={{ color: "var(--foreground)", opacity: 0.6 }}>
              Share my location with AI for more relevant recommendations
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={weatherOnly} onChange={(e) => setWeatherOnly(e.target.checked)} className="rounded" />
            <span className="text-xs" style={{ color: "var(--foreground)", opacity: 0.6 }}>
              Weather only (skip AI outfit recommendation)
            </span>
          </label>
        </div>

        {/* ── Layout Mode ── */}
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>
              Dashboard Layout
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--foreground)", opacity: 0.5 }}>
              Controls how the dashboard splits the weather and settings panels.
            </p>
          </div>

          {/* Slider track */}
          <div className="space-y-3">
            <input
              type="range"
              min={0}
              max={2}
              step={1}
              value={layoutIndex}
              onChange={(e) => setLayoutMode(LAYOUT_OPTIONS[Number(e.target.value)].value)}
              className="w-full accent-[var(--accent)] h-1.5 rounded-full cursor-pointer"
              style={{ accentColor: "var(--accent)" }}
            />
            {/* Labels below slider */}
            <div className="flex justify-between text-xs" style={{ color: "var(--foreground)", opacity: 0.5 }}>
              {LAYOUT_OPTIONS.map((o) => (
                <span
                  key={o.value}
                  className="text-center"
                  style={{
                    width: "33%",
                    fontWeight: layoutMode === o.value ? 600 : 400,
                    color: layoutMode === o.value ? "var(--accent)" : undefined,
                    opacity: layoutMode === o.value ? 1 : 0.5,
                  }}
                >
                  {o.label}
                </span>
              ))}
            </div>
            {/* Active description */}
            <p className="text-xs rounded-xl px-3 py-2" style={{ background: "var(--background)", color: "var(--foreground)", opacity: 0.7 }}>
              {LAYOUT_OPTIONS[layoutIndex].desc}
            </p>
          </div>

          {/* Visual preview of the layout split */}
          <div className="flex gap-1 h-10 rounded-xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
            <div
              className="rounded-l-xl transition-all duration-300"
              style={{
                background: "var(--accent)",
                opacity: 0.7,
                flex: layoutMode === "symmetric" ? 1 : layoutMode === "large-weather" ? 1.5 : 1,
              }}
            />
            <div
              className="rounded-r-xl transition-all duration-300"
              style={{
                background: "var(--foreground)",
                opacity: 0.15,
                flex: layoutMode === "symmetric" ? 1 : layoutMode === "large-settings" ? 1.5 : 1,
              }}
            />
          </div>
          <div className="flex text-xs" style={{ color: "var(--foreground)", opacity: 0.4 }}>
            <span style={{ flex: layoutMode === "symmetric" ? 1 : layoutMode === "large-weather" ? 1.5 : 1 }} className="text-center">Weather</span>
            <span style={{ flex: layoutMode === "symmetric" ? 1 : layoutMode === "large-settings" ? 1.5 : 1 }} className="text-center">Settings</span>
          </div>
        </div>

        {/* ── Extra Side Spacing ── */}
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                Extra Side Spacing
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground)", opacity: 0.5 }}>
                Adds extra horizontal padding to selected pages.
              </p>
            </div>
            {/* Toggle switch */}
            <button
              role="switch"
              aria-checked={extraSpacing}
              onClick={() => setExtraSpacing((v) => !v)}
              className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 btn-interact"
              style={{ background: extraSpacing ? "var(--accent)" : "var(--card-border)" }}
            >
              <span
                className="pointer-events-none inline-block h-5 w-5 rounded-full shadow transform transition-transform duration-200"
                style={{
                  background: "#fff",
                  transform: extraSpacing ? "translate(22px, 2px)" : "translate(2px, 2px)",
                }}
              />
            </button>
          </div>

          {extraSpacing && (
            <div className="space-y-2 pt-1">
              <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.5 }}>Apply to pages:</p>
              {(["dashboard", "account", "settings"] as const).map((page) => (
                <label key={page} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={extraSpacingPages.includes(page)}
                    onChange={() => toggleExtraSpacingPage(page)}
                    className="rounded"
                  />
                  <span className="text-xs capitalize" style={{ color: "var(--foreground)", opacity: 0.7 }}>
                    {page === "dashboard" ? "Dashboard" : page === "account" ? "Account" : "Settings"}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* ── Custom Spacing (drag to resize) ── */}
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                Custom Column Spacing
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground)", opacity: 0.5 }}>
                When on, drag the divider between panels on the dashboard to resize them freely.
              </p>
            </div>
            {/* Toggle switch */}
            <button
              role="switch"
              aria-checked={customSpacing}
              onClick={() => setCustomSpacing((v) => !v)}
              className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 btn-interact"
              style={{ background: customSpacing ? "var(--accent)" : "var(--card-border)" }}
            >
              <span
                className="pointer-events-none inline-block h-5 w-5 rounded-full shadow transform transition-transform duration-200"
                style={{
                  background: "#fff",
                  transform: customSpacing ? "translate(22px, 2px)" : "translate(2px, 2px)",
                }}
              />
            </button>
          </div>
          {customSpacing && (
            <p className="text-xs rounded-xl px-3 py-2" style={{ background: "var(--background)", color: "var(--foreground)", opacity: 0.6 }}>
              💡 On the dashboard, hover between the two panels to reveal a drag handle. Drag it left or right to adjust column widths. The ratio is saved automatically.
            </p>
          )}
        </div>

        <p className="text-xs text-center" style={{ color: "var(--foreground)", opacity: 0.4 }}>
          These settings apply to your outfit recommendations on the dashboard.
        </p>
      </div>
    </div>
  );
}
