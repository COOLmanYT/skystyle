"use client";

import { useState, useEffect } from "react";
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
type ThemeMode = "system" | "light" | "dark";
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
  const [customGender, setCustomGender] = useState<string>(() => getLocalStorage("skystyle_custom_gender", ""));
  const [unitPreference, setUnitPreference] = useState<"metric" | "imperial">(initialUnitPreference);
  const [themeMode, setThemeMode] = useState<ThemeMode>(
    () => (getLocalStorage("skystyle_theme_mode", "system") as ThemeMode)
  );
  const [shareLocation, setShareLocation] = useState(() => getLocalStorage("skystyle_location_consent", "false") === "true");
  const [weatherOnly, setWeatherOnly] = useState(() => getLocalStorage("skystyle_weather_only", "false") === "true");
  const [defaultSimpleMode, setDefaultSimpleMode] = useState(
    () => getLocalStorage("skystyle_simple_mode", "true") === "true"
  );

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
    // localStorage is used intentionally for client-side UI preferences (theme,
    // layout, spacing). Gender preference and BYOK API keys are also stored
    // client-side only — never sent to Sky Style servers except when required
    // for AI requests.
    try {
      localStorage.setItem("skystyle_theme_mode", themeMode);
      localStorage.setItem("skystyle_location_consent", String(shareLocation));
      localStorage.setItem("skystyle_weather_only", String(weatherOnly));
      localStorage.setItem("skystyle_simple_mode", String(defaultSimpleMode));
      localStorage.setItem("skystyle_layout_mode", layoutMode);
      localStorage.setItem("skystyle_extra_spacing", String(extraSpacing));
      localStorage.setItem("skystyle_extra_spacing_pages", extraSpacingPages.join(","));
      localStorage.setItem("skystyle_custom_spacing", String(customSpacing));
      localStorage.setItem("skystyle_gender", gender);
      localStorage.setItem("skystyle_custom_gender", customGender);
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

        {/* Appearance */}
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--foreground)", opacity: 0.4 }}>
            Appearance
          </p>
          <div className="flex gap-2">
            {(["system", "light", "dark"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setThemeMode(mode)}
                className="rounded-xl px-3 py-1.5 text-xs font-medium btn-interact capitalize"
                style={{
                  background: themeMode === mode ? "var(--accent)" : "var(--background)",
                  color: themeMode === mode ? "#fff" : "var(--foreground)",
                  border: "1px solid var(--card-border)",
                }}
              >
                {mode}
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
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={defaultSimpleMode}
              onChange={(e) => setDefaultSimpleMode(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs" style={{ color: "var(--foreground)", opacity: 0.6 }}>
              Default to Simple Mode on Terms &amp; Privacy pages (plain-English summaries)
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

        {/* ── Changelog ── */}
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>
              Changelog
            </p>
            <Link
              href="/changelog"
              className="text-xs btn-interact rounded-xl px-3 py-1"
              style={{ color: "var(--accent)" }}
            >
              View all →
            </Link>
          </div>
          <ChangelogPreview />
        </div>

        <p className="text-xs text-center" style={{ color: "var(--foreground)", opacity: 0.4 }}>
          These settings apply to your outfit recommendations on the dashboard.
        </p>
      </div>
    </div>
  );
}

function ChangelogPreview() {
  const [entries, setEntries] = useState<{ date: string; version: string; title: string; description: string }[]>([]);

  function formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHour = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHour / 24);
    const diffWeek = Math.round(diffDay / 7);
    const diffMonth = Math.round(diffDay / 30);
    const diffYear = Math.round(diffDay / 365);
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    if (diffSec < 60) return rtf.format(-diffSec, "second");
    if (diffMin < 60) return rtf.format(-diffMin, "minute");
    if (diffHour < 24) return rtf.format(-diffHour, "hour");
    if (diffDay < 7) return rtf.format(-diffDay, "day");
    if (diffWeek < 4) return rtf.format(-diffWeek, "week");
    if (diffMonth < 12) return rtf.format(-diffMonth, "month");
    return rtf.format(-diffYear, "year");
  }

  useEffect(() => {
    fetch("/api/changelog")
      .then((r) => r.json())
      .then((data: { date: string; version: string; title: string; description: string }[]) => setEntries(data.slice(0, 5)))
      .catch(() => {});
  }, []);

  if (!entries.length) return null;

  return (
    <div className="relative">
      <div
        className="absolute left-[7px] top-3"
        style={{ width: 2, bottom: 8, background: "var(--card-border)", willChange: "auto" }}
        aria-hidden="true"
      />
      <div className="space-y-5">
        {entries.map((entry, i) => (
          <div key={entry.version} className="relative flex gap-5">
            <div
              className="relative z-10 mt-1 flex-shrink-0"
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: i === 0 ? "var(--accent)" : "var(--card-border)",
                boxShadow: i === 0 ? "0 0 0 3px var(--card), 0 0 0 5px var(--accent)" : "0 0 0 3px var(--card)",
              }}
              aria-hidden="true"
            />
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="text-xs font-mono px-2 py-0.5 rounded-lg"
                  style={{ background: "var(--background)", color: "var(--foreground)", opacity: 0.7 }}
                >
                  v{entry.version}
                </span>
                <span className="text-xs" style={{ color: "var(--foreground)", opacity: 0.45 }}>
                  {formatRelativeTime(entry.date)}
                </span>
              </div>
              <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>{entry.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--foreground)", opacity: 0.6 }}>{entry.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
