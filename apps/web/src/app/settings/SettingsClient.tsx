"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Toggle from "@/components/Toggle";
import Checkbox from "@/components/Checkbox";
import HamburgerNav from "@/components/HamburgerNav";
import { handleSignOut } from "@/app/actions";

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
type WeatherPlanningVisibility = "always_open" | "closed_default" | "disabled";
type FollowUpMode = "replace" | "chat";
const LAYOUT_OPTIONS: { value: LayoutMode; label: string; desc: string }[] = [
  { value: "symmetric",      label: "Symmetrical Split",  desc: "Both panels are equal width" },
  { value: "large-weather",  label: "Large Weather",      desc: "Weather panel is wider (default)" },
  { value: "large-settings", label: "Large Settings",     desc: "Settings panel is wider" },
];
const WEATHER_PLANNING_OPTIONS: { value: WeatherPlanningVisibility; label: string; desc: string }[] = [
  { value: "always_open",    label: "Always Open",        desc: "Panel starts expanded every time" },
  { value: "closed_default", label: "Closed by Default",  desc: "Panel is collapsed by default (current)" },
  { value: "disabled",       label: "Disabled",           desc: "Hide the Weather Planning panel entirely" },
];

interface SettingsClientProps {
  initialUnitPreference: "metric" | "imperial";
}

export default function SettingsClient({ initialUnitPreference }: SettingsClientProps) {
  const [gender, setGender] = useState<string>(() => {
    const stored = getLocalStorage("skystyle_gender", "N/A");
    if (!stored) return "N/A";
    try {
      // Decode stored gender; fall back to raw value if decoding fails
      return atob(stored);
    } catch {
      return stored;
    }
  });
  const [customGender, setCustomGender] = useState<string>(() => {
    const stored = getLocalStorage("skystyle_custom_gender", "");
    if (!stored) return "";
    try {
      // Decode stored custom gender; fall back to raw value if decoding fails
      return atob(stored);
    } catch {
      return stored;
    }
  });
  const [unitPreference, setUnitPreference] = useState<"metric" | "imperial">(initialUnitPreference);
  const [themeMode, setThemeMode] = useState<ThemeMode>(
    () => (getLocalStorage("skystyle_theme_mode", "system") as ThemeMode)
  );
  const [shareLocation, setShareLocation] = useState(() => getLocalStorage("skystyle_location_consent", "false") === "true");
  const [weatherOnly, setWeatherOnly] = useState(() => getLocalStorage("skystyle_weather_only", "false") === "true");
  const [defaultSimpleMode, setDefaultSimpleMode] = useState(
    () => getLocalStorage("skystyle_simple_mode", "true") === "true"
  );

  // Dashboard Behaviour settings
  const [weatherPlanningVisibility, setWeatherPlanningVisibility] = useState<WeatherPlanningVisibility>(
    () => (getLocalStorage("skystyle_weather_planning", "closed_default") as WeatherPlanningVisibility)
  );
  const [followUpMode, setFollowUpMode] = useState<FollowUpMode>(
    () => (getLocalStorage("skystyle_followup_mode", "replace") as FollowUpMode)
  );
  const [showDiagnostics, setShowDiagnostics] = useState(
    () => getLocalStorage("skystyle_show_diagnostics", "false") === "true"
  );
  const [byokOpenDefault, setByokOpenDefault] = useState(
    () => getLocalStorage("skystyle_byok_open", "false") === "true"
  );
  // Default recommendation complexity (0=Simple, 1=Simple+, 2=Advanced, 3=Pro)
  const [defaultComplexity, setDefaultComplexity] = useState<number>(
    () => {
      try {
        const saved = localStorage.getItem("skystyle_planning_panel");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.complexity != null) return Number(parsed.complexity);
        }
      } catch { /* ignore */ }
      return 0;
    }
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
      localStorage.setItem("skystyle_weather_planning", weatherPlanningVisibility);
      localStorage.setItem("skystyle_followup_mode", followUpMode);
      localStorage.setItem("skystyle_show_diagnostics", String(showDiagnostics));
      localStorage.setItem("skystyle_byok_open", String(byokOpenDefault));
      // Update planning panel default complexity (merge into existing panel state)
      try {
        const existing = localStorage.getItem("skystyle_planning_panel");
        const panelState = existing ? JSON.parse(existing) : {};
        panelState.complexity = defaultComplexity;
        localStorage.setItem("skystyle_planning_panel", JSON.stringify(panelState));
      } catch { /* ignore */ }
      try {
        // Encode gender before storing
        localStorage.setItem("skystyle_gender", btoa(gender));
      } catch {
        /* ignore encoding errors */
      }
      try {
        // Encode custom gender before storing
        localStorage.setItem("skystyle_custom_gender", btoa(customGender));
      } catch {
        /* ignore encoding errors */
      }
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
      <HamburgerNav
        currentPage="settings"
        title="⚙️ Settings"
        signOutAction={handleSignOut}
        rightContent={
          <button
            onClick={handleSave}
            className="rounded-xl px-4 py-2 text-sm font-medium btn-interact"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Save
          </button>
        }
      />

      {/* Content */}
      <main id="main-content">
      <div
        className="max-w-2xl mx-auto py-8 space-y-6"
        style={{
          paddingLeft: settingsExtraSpacing ? 48 : 16,
          paddingRight: settingsExtraSpacing ? 48 : 16,
        }}
      >
        {savedMessage && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-2xl p-4 text-sm text-center font-medium"
            style={{
              background: "#34c75915",
              border: "1px solid #34c75940",
              color: "#34c759",
            }}
          >
            <span aria-hidden="true">✅ </span>{savedMessage}
          </div>
        )}

        {/* Gender */}
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <p id="settings-gender-label" className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--foreground)", opacity: 0.4 }}>
            Gender (for outfit recommendations)
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="settings-gender-label">
            {["Male", "Female", "Other", "Other - Manual"].map((opt) => (
              <button
                key={opt}
                onClick={() => setGender(opt === "Other" ? "N/A" : opt)}
                className="rounded-xl px-3 py-1.5 text-xs font-medium btn-interact"
                aria-pressed={isGenderActive(opt, gender)}
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
            <>
              <label htmlFor="settings-custom-gender" className="sr-only">Custom gender description</label>
              <input
                id="settings-custom-gender"
                type="text"
                value={customGender}
                onChange={(e) => setCustomGender(e.target.value.slice(0, MAX_GENDER_LENGTH))}
                placeholder={`Type your gender (max ${MAX_GENDER_LENGTH} chars)`}
                maxLength={MAX_GENDER_LENGTH}
                className="mt-2 w-full rounded-xl px-3 py-2 text-xs outline-none"
                style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--card-border)" }}
              />
            </>
          )}
        </div>

        {/* Units */}
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <p id="settings-units-label" className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--foreground)", opacity: 0.4 }}>
            Units
          </p>
          <div className="flex gap-2" role="group" aria-labelledby="settings-units-label">
            {(["metric", "imperial"] as const).map((unit) => (
              <button
                key={unit}
                onClick={() => setUnitPreference(unit)}
                className="rounded-xl px-3 py-1.5 text-xs font-medium btn-interact capitalize"
                aria-pressed={unitPreference === unit}
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
          <p id="settings-appearance-label" className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--foreground)", opacity: 0.4 }}>
            Appearance
          </p>
          <div className="flex gap-2" role="group" aria-labelledby="settings-appearance-label">
            {(["system", "light", "dark"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setThemeMode(mode)}
                className="rounded-xl px-3 py-1.5 text-xs font-medium btn-interact capitalize"
                aria-pressed={themeMode === mode}
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
          <Checkbox
            checked={shareLocation}
            onChange={setShareLocation}
            label="Share my location with AI for more relevant recommendations"
          />
          <Checkbox
            checked={weatherOnly}
            onChange={setWeatherOnly}
            label="Weather only (skip AI outfit recommendation)"
          />
          <Checkbox
            checked={defaultSimpleMode}
            onChange={setDefaultSimpleMode}
            label="Default to Simple Mode on Terms & Privacy pages (plain-English summaries)"
          />
        </div>

        {/* ── Dashboard Behaviour ── */}
        <div
          className="rounded-2xl p-5 space-y-5"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>
            Dashboard Behaviour
          </p>

          {/* Weather Planning visibility */}
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: "var(--foreground)", opacity: 0.7 }}>Weather Planning Panel</p>
            <div className="flex flex-wrap gap-2">
              {WEATHER_PLANNING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setWeatherPlanningVisibility(opt.value)}
                  className="rounded-xl px-3 py-1.5 text-xs font-medium btn-interact"
                  style={{
                    background: weatherPlanningVisibility === opt.value ? "var(--accent)" : "var(--background)",
                    color: weatherPlanningVisibility === opt.value ? "#fff" : "var(--foreground)",
                    border: "1px solid var(--card-border)",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.45 }}>
              {WEATHER_PLANNING_OPTIONS.find((o) => o.value === weatherPlanningVisibility)?.desc}
            </p>
          </div>

          {/* Recommendation Mode Default */}
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: "var(--foreground)", opacity: 0.7 }}>Default Recommendation Mode</p>
            <div className="flex flex-wrap gap-2">
              {([["Simple", 0], ["Simple+", 1], ["Advanced", 2], ["Pro", 3]] as [string, number][]).map(([label, val]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setDefaultComplexity(val)}
                  className="rounded-xl px-3 py-1.5 text-xs font-medium btn-interact"
                  style={{
                    background: defaultComplexity === val ? "var(--accent)" : "var(--background)",
                    color: defaultComplexity === val ? "#fff" : "var(--foreground)",
                    border: "1px solid var(--card-border)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.45 }}>
              Sets the default complexity level in the Weather Planning panel.
            </p>
          </div>

          {/* Follow-Up Mode */}
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: "var(--foreground)", opacity: 0.7 }}>Follow-Up Mode</p>
            <div className="flex gap-2">
              {(["replace", "chat"] as FollowUpMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFollowUpMode(mode)}
                  className="rounded-xl px-3 py-1.5 text-xs font-medium btn-interact"
                  style={{
                    background: followUpMode === mode ? "var(--accent)" : "var(--background)",
                    color: followUpMode === mode ? "#fff" : "var(--foreground)",
                    border: "1px solid var(--card-border)",
                  }}
                >
                  {mode === "replace" ? "Replace Mode" : "Chat Mode"}
                </button>
              ))}
            </div>
            <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.45 }}>
              {followUpMode === "replace"
                ? "Follow-ups replace the current outfit suggestion (default)."
                : "Follow-ups add new response blocks below, maintaining a conversation history."}
            </p>
          </div>

          {/* Session Diagnostics */}
          <Checkbox
            checked={showDiagnostics}
            onChange={setShowDiagnostics}
            label="Show Session Diagnostics panel on Dashboard"
          />

          {/* BYOK open by default */}
          <Checkbox
            checked={byokOpenDefault}
            onChange={setByokOpenDefault}
            label="Expand Bring Your Own Key panel by default"
          />
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
          <Toggle
            checked={extraSpacing}
            onChange={setExtraSpacing}
            label="Extra Side Spacing"
            description="Adds extra horizontal padding to selected pages."
          />

          {extraSpacing && (
            <div className="space-y-2 pt-1">
              <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.5 }}>Apply to pages:</p>
              {(["dashboard", "account", "settings"] as const).map((page) => (
                <Checkbox
                  key={page}
                  checked={extraSpacingPages.includes(page)}
                  onChange={() => toggleExtraSpacingPage(page)}
                  label={page === "dashboard" ? "Dashboard" : page === "account" ? "Account" : "Settings"}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Custom Spacing (drag to resize) ── */}
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <Toggle
            checked={customSpacing}
            onChange={setCustomSpacing}
            label="Custom Column Spacing"
            description="When on, drag the divider between panels on the dashboard to resize them freely."
          />
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

        {/* ── Feedback ── */}
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>
              Feedback
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--foreground)", opacity: 0.5 }}>
              Share a bug report, a suggestion, or just say hello — every message is read personally.
            </p>
          </div>
          <Link
            href="/feedback"
            className="inline-block rounded-xl px-4 py-2 text-xs font-semibold btn-interact"
            style={{
              background: "var(--background)",
              color: "var(--accent)",
              border: "1px solid var(--card-border)",
            }}
          >
            Share Feedback →
          </Link>
        </div>

        <p className="text-xs text-center" style={{ color: "var(--foreground)", opacity: 0.4 }}>
          These settings apply to your outfit recommendations on the dashboard.
        </p>
        {/* Quick links to security/privacy */}
        <div className="flex items-center justify-center gap-4 text-xs" style={{ color: "var(--foreground)", opacity: 0.4 }}>
          <Link href="/settings/security" className="underline hover:opacity-70">Security</Link>
          <Link href="/settings/privacy" className="underline hover:opacity-70">Privacy Hub</Link>
          <Link href="/account" className="underline hover:opacity-70">Account</Link>
        </div>
      </div>
      </main>
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
