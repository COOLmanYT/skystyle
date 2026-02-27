"use client";

import { useState } from "react";
import LocationPicker, { ResolvedLocation } from "./LocationPicker";
import { handleSignOut } from "@/app/actions";
import Link from "next/link";

interface HourlyForecast {
  time: string;
  temp: number;
  description: string;
  rainChance: number;
  windSpeed: number;
}

interface StyleResponse {
  weather: {
    temp: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    windDir: string;
    description: string;
    rainChance: number;
    uvIndex: number;
    isDay: boolean;
    alerts: string[];
    stationName: string;
    stationDistanceKm: number;
    accuracyScore: "High" | "Medium" | "Low";
    source: "BOM" | "OpenWeather" | "Custom" | "Multi";
    hourly?: HourlyForecast[];
    sources?: {
      source: string;
      temp: number;
      feelsLike: number;
      humidity: number;
      windSpeed: number;
      windDir: string;
      description: string;
      rainChance: number;
      uvIndex: number;
    }[];
  };
  recommendation: {
    outfit: string;
    reasoning: string;
  };
  meta: {
    isPro: boolean;
    unitPreference: "metric" | "imperial";
    creditsRemaining: number | null;
    dailyLimits?: DailyLimits;
  };
}

interface DailyLimits {
  ai: { used: number; limit: number };
  followUps: { used: number; limit: number };
  closet: { used: number; limit: number };
  sourcePicks: { used: number; limit: number };
}

const ACCURACY_COLOR: Record<string, string> = {
  High: "#34c759",
  Medium: "#ff9500",
  Low: "#ff3b30",
};

const SOURCE_LINKS: Record<string, string> = {
  OpenWeather: "https://openweathermap.org/",
  "Open-Meteo": "https://open-meteo.com/",
  BOM: "http://www.bom.gov.au/",
  WeatherAPI: "https://www.weatherapi.com/",
  VisualCrossing: "https://www.visualcrossing.com/",
  PirateWeather: "https://pirateweather.net/",
};

const MAX_GENDER_LENGTH = 30;

/** Returns true if the given option string matches the current gender state */
function isGenderActive(option: string, gender: string): boolean {
  return (option === "Other" && gender === "N/A") || gender === option;
}

interface DashboardProps {
  userName: string;
  userEmail: string;
  isPro: boolean;
  initialCredits: number | null;
  initialDailyLimits: DailyLimits | null;
}

export default function Dashboard({
  userName,
  userEmail,
  isPro,
  initialCredits,
  initialDailyLimits,
}: DashboardProps) {
  const [location, setLocation] = useState<ResolvedLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StyleResponse | null>(null);
  const [followUpText, setFollowUpText] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [dailyLimits, setDailyLimits] = useState<DailyLimits | null>(initialDailyLimits);
  const [gender, setGender] = useState<string>("N/A");
  const [customGender, setCustomGender] = useState("");
  const [shareLocation, setShareLocation] = useState(false);

  const creditsRemaining = result?.meta?.creditsRemaining ?? initialCredits;

  async function handleLocationResolved(loc: ResolvedLocation) {
    setLocation(loc);
    setError(null);
    setResult(null);
    setLoading(true);
    setFollowUpText("");
    setFollowUpError(null);
    try {
      const effectiveGender = gender === "Other - Manual" ? customGender.slice(0, MAX_GENDER_LENGTH) : gender;
      const res = await fetch("/api/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: loc.lat, lon: loc.lon, gender: effectiveGender, shareLocation }),
      });
      if (!res.ok) {
        let errorMessage = "Something went wrong.";
        try {
          const data = await res.json();
          errorMessage = data.error ?? errorMessage;
        } catch {
          /* non-JSON error response */
        }
        setError(errorMessage);
      } else {
        const data = await res.json();
        const styleResult = data as StyleResponse;
        setResult(styleResult);
        if (styleResult.meta?.dailyLimits) {
          setDailyLimits(styleResult.meta.dailyLimits);
        }
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFollowUp(e: React.FormEvent) {
    e.preventDefault();
    if (!followUpText.trim() || !result) return;
    setFollowUpLoading(true);
    setFollowUpError(null);
    try {
      const res = await fetch("/api/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: followUpText.trim(),
          previousOutfit: result.recommendation.outfit,
          previousReasoning: result.recommendation.reasoning,
          weather: result.weather,
        }),
      });
      if (!res.ok) {
        let errorMessage = "Follow-up failed.";
        try {
          const data = await res.json();
          errorMessage = data.error ?? errorMessage;
        } catch {
          /* non-JSON */
        }
        setFollowUpError(errorMessage);
      } else {
        const data = await res.json();
        setResult((prev) =>
          prev ? { ...prev, recommendation: data.recommendation } : prev
        );
        if (data.meta?.dailyLimits) {
          setDailyLimits(data.meta.dailyLimits);
        }
        setFollowUpText("");
      }
    } catch {
      setFollowUpError("Network error — please try again.");
    } finally {
      setFollowUpLoading(false);
    }
  }

  const w = result?.weather;
  const rec = result?.recommendation;
  const meta = result?.meta;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--background)" }}
    >
      <div className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-5">
          {/* ── Heading ── */}
          <div className="flex items-center justify-between">
            <div>
              <h1
                className="text-2xl font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                🌤️ Sky Style
              </h1>
              <p
                className="text-sm"
                style={{ color: "var(--foreground)", opacity: 0.5 }}
              >
                Good day, {userName}
              </p>
            </div>
            <form action={handleSignOut}>
              <button
                type="submit"
                className="rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--card-border)",
                  color: "var(--foreground)",
                }}
              >
                Sign Out
              </button>
            </form>
          </div>

          {/* ── Location Picker ── */}
          <LocationPicker onLocationResolved={handleLocationResolved} />

          {/* ── Gender & Location Consent ── */}
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
            }}
          >
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: "var(--foreground)", opacity: 0.4 }}
              >
                Gender (for outfit recommendations)
              </p>
              <div className="flex flex-wrap gap-2">
                {["Male", "Female", "Other", "Other - Manual"].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setGender(opt === "Other" ? "N/A" : opt)}
                    className="rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity"
                    style={{
                      background: isGenderActive(opt, gender)
                        ? "var(--accent)"
                        : "var(--background)",
                      color: isGenderActive(opt, gender)
                        ? "#fff"
                        : "var(--foreground)",
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
                  style={{
                    background: "var(--background)",
                    color: "var(--foreground)",
                    border: "1px solid var(--card-border)",
                  }}
                />
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={shareLocation}
                onChange={(e) => setShareLocation(e.target.checked)}
                className="rounded"
              />
              <span
                className="text-xs"
                style={{ color: "var(--foreground)", opacity: 0.6 }}
              >
                Share my location with AI for more relevant recommendations
              </span>
            </label>
          </div>

          {location && (
            <div
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs"
              style={{
                background: "var(--card)",
                border: "1px solid var(--card-border)",
                color: "var(--foreground)",
                opacity: 0.8,
              }}
            >
              <span>{location.source === "gps" ? "📍" : "🔍"}</span>
              <span className="truncate">{location.displayName}</span>
            </div>
          )}

          {/* ── Loading ── */}
          {loading && (
            <div
              className="rounded-2xl p-8 flex flex-col items-center gap-3"
              style={{
                background: "var(--card)",
                border: "1px solid var(--card-border)",
              }}
            >
              <div className="text-3xl animate-bounce">✨</div>
              <p
                className="text-sm"
                style={{ color: "var(--foreground)", opacity: 0.6 }}
              >
                Fetching weather &amp; styling your look…
              </p>
            </div>
          )}

          {/* ── Error ── */}
          {error && !loading && (
            <div
              className="rounded-2xl p-4 text-sm"
              style={{
                background: "#ff3b3015",
                border: "1px solid #ff3b3040",
                color: "#ff3b30",
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* ── Main Weather Card ── */}
          {result && !loading && (
            <>
              <div
                className="rounded-2xl p-5 space-y-3"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--card-border)",
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p
                      className="text-4xl font-thin"
                      style={{ color: "var(--foreground)" }}
                    >
                      {meta?.unitPreference === "imperial"
                        ? `${Math.round((w!.temp * 9) / 5 + 32)}°F`
                        : `${w!.temp}°C`}
                    </p>
                    <p
                      className="text-sm capitalize mt-0.5"
                      style={{ color: "var(--foreground)", opacity: 0.55 }}
                    >
                      {w!.description} · feels like{" "}
                      {meta?.unitPreference === "imperial"
                        ? `${Math.round((w!.feelsLike * 9) / 5 + 32)}°F`
                        : `${w!.feelsLike}°C`}
                    </p>
                  </div>
                  <span className="text-4xl">
                    {weatherEmoji(w!.description, w!.isDay)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {[
                    { label: "Humidity", value: `${w!.humidity}%`, icon: "💧" },
                    { label: "Rain chance", value: `${w!.rainChance}%`, icon: "🌧" },
                    {
                      label: "Wind",
                      value: `${
                        meta?.unitPreference === "imperial"
                          ? `${Math.round(w!.windSpeed * 0.621)}mph`
                          : `${w!.windSpeed}km/h`
                      } ${w!.windDir}`,
                      icon: "💨",
                    },
                    { label: "UV Index", value: `${w!.uvIndex}`, icon: "☀️" },
                    {
                      label: "Feels like",
                      value: meta?.unitPreference === "imperial"
                        ? `${Math.round((w!.feelsLike * 9) / 5 + 32)}°F`
                        : `${w!.feelsLike}°C`,
                      icon: "🌡️",
                    },
                    { label: "Time", value: w!.isDay ? "Daytime" : "Night-time", icon: w!.isDay ? "🌞" : "🌙" },
                  ].map(({ label, value, icon }) => (
                    <div
                      key={label}
                      className="rounded-xl p-2.5 text-center"
                      style={{ background: "var(--background)" }}
                    >
                      <p
                        className="text-xs"
                        style={{ color: "var(--foreground)", opacity: 0.45 }}
                      >
                        {icon} {label}
                      </p>
                      <p
                        className="text-sm font-medium mt-0.5"
                        style={{ color: "var(--foreground)" }}
                      >
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Alerts — shown prominently */}
                {w!.alerts.length > 0 && (
                  <div
                    className="rounded-xl p-3 text-xs space-y-1"
                    style={{
                      background: "#ff950022",
                      border: "1px solid #ff950040",
                    }}
                  >
                    <p className="font-semibold uppercase tracking-widest" style={{ color: "#ff9500" }}>
                      ⚠️ Weather Alerts
                    </p>
                    {w!.alerts.map((a, i) => (
                      <p key={i} style={{ color: "#ff9500" }}>
                        {a}
                      </p>
                    ))}
                  </div>
                )}

                {/* Per-source breakdown */}
                {w!.sources && w!.sources.length > 1 && (
                  <div className="pt-2">
                    <p
                      className="text-xs font-semibold uppercase tracking-widest mb-2"
                      style={{ color: "var(--foreground)", opacity: 0.4 }}
                    >
                      Per-Source Breakdown
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" style={{ color: "var(--foreground)" }}>
                        <thead>
                          <tr style={{ opacity: 0.5 }}>
                            <th className="text-left py-1 pr-2">Source</th>
                            <th className="text-right py-1 px-1">Temp</th>
                            <th className="text-right py-1 px-1">Feels</th>
                            <th className="text-right py-1 px-1">Hum.</th>
                            <th className="text-right py-1 px-1">Wind</th>
                            <th className="text-right py-1 px-1">Rain</th>
                            <th className="text-right py-1 px-1">UV</th>
                          </tr>
                        </thead>
                        <tbody>
                          {w!.sources.map((s) => (
                            <tr key={s.source}>
                              <td className="py-1 pr-2">
                                {SOURCE_LINKS[s.source] ? (
                                  <a
                                    href={SOURCE_LINKS[s.source]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline hover:opacity-70"
                                    style={{ color: "var(--accent)" }}
                                  >
                                    {s.source}
                                  </a>
                                ) : (
                                  s.source
                                )}
                              </td>
                              <td className="text-right py-1 px-1">
                                {meta?.unitPreference === "imperial"
                                  ? `${Math.round((s.temp * 9) / 5 + 32)}°F`
                                  : `${s.temp}°C`}
                              </td>
                              <td className="text-right py-1 px-1">
                                {meta?.unitPreference === "imperial"
                                  ? `${Math.round((s.feelsLike * 9) / 5 + 32)}°F`
                                  : `${s.feelsLike}°C`}
                              </td>
                              <td className="text-right py-1 px-1">{s.humidity}%</td>
                              <td className="text-right py-1 px-1">
                                {meta?.unitPreference === "imperial"
                                  ? `${Math.round(s.windSpeed * 0.621)}mph`
                                  : `${s.windSpeed}km/h`}{" "}
                                {s.windDir}
                              </td>
                              <td className="text-right py-1 px-1">{s.rainChance}%</td>
                              <td className="text-right py-1 px-1">{s.uvIndex}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Data sources badge */}
                <div className="flex items-center gap-2 pt-1">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{
                      background: ACCURACY_COLOR[w!.accuracyScore],
                    }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: "var(--foreground)", opacity: 0.5 }}
                  >
                    {w!.accuracyScore} accuracy · {w!.stationName} (
                    {w!.stationDistanceKm} km) · {w!.source}
                    {w!.sources && w!.sources.length > 1 && (
                      <> — averaged from {w!.sources.length} sources</>
                    )}
                  </span>
                </div>

                {/* Weather source attribution */}
                <div
                  className="rounded-xl p-3"
                  style={{ background: "var(--background)" }}
                >
                  <p
                    className="text-xs font-semibold uppercase tracking-widest mb-1.5"
                    style={{ color: "var(--foreground)", opacity: 0.4 }}
                  >
                    Data Sources &amp; Credits
                  </p>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "var(--foreground)", opacity: 0.5 }}
                  >
                    Weather data from{" "}
                    {[...new Set([
                      ...(w!.sources ?? []).map((s) => s.source),
                      ...(w!.sources ? [] : [w!.source]),
                    ])]
                      .map((name) => {
                        const link = SOURCE_LINKS[name];
                        return link ? (
                          <a
                            key={name}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:opacity-70"
                            style={{ color: "var(--accent)" }}
                          >
                            {name}
                          </a>
                        ) : (
                          <span key={name}>{name}</span>
                        );
                      })
                      .reduce<React.ReactNode[]>((acc, el, i) => {
                        if (i > 0) acc.push(<span key={`sep-${i}`}>, </span>);
                        acc.push(el);
                        return acc;
                      }, [])}
                    . AI by{" "}
                    <a href="https://openai.com/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: "var(--accent)" }}>OpenAI</a>
                    {" / "}
                    <a href="https://deepmind.google/technologies/gemini/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: "var(--accent)" }}>Google Gemini</a>
                    . Geocoding by{" "}
                    <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: "var(--accent)" }}>OpenStreetMap Nominatim</a>
                    .
                  </p>
                </div>

                {/* Hourly forecast */}
                {w!.hourly && w!.hourly.length > 0 && (
                  <div className="pt-2">
                    <p
                      className="text-xs font-semibold uppercase tracking-widest mb-2"
                      style={{ color: "var(--foreground)", opacity: 0.4 }}
                    >
                      Hourly Forecast
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {w!.hourly.slice(0, 12).map((h, i) => (
                        <div
                          key={i}
                          className="flex-shrink-0 rounded-xl p-2 text-center min-w-[72px]"
                          style={{ background: "var(--background)" }}
                        >
                          <p
                            className="text-xs"
                            style={{
                              color: "var(--foreground)",
                              opacity: 0.5,
                            }}
                          >
                            {new Date(h.time).getHours()}:00
                          </p>
                          <p
                            className="text-sm font-medium"
                            style={{ color: "var(--foreground)" }}
                          >
                            {meta?.unitPreference === "imperial"
                              ? `${Math.round((h.temp * 9) / 5 + 32)}°`
                              : `${h.temp}°`}
                          </p>
                          <p
                            className="text-xs"
                            style={{
                              color: "var(--foreground)",
                              opacity: 0.4,
                            }}
                          >
                            🌧{h.rainChance}%
                          </p>
                          <p
                            className="text-xs"
                            style={{
                              color: "var(--foreground)",
                              opacity: 0.35,
                            }}
                          >
                            💨{meta?.unitPreference === "imperial"
                              ? `${Math.round(h.windSpeed * 0.621)}`
                              : h.windSpeed}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Outfit Recommendation ── */}
              <div
                className="rounded-2xl p-5 space-y-3"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--card-border)",
                }}
              >
                <h2
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--accent)" }}
                >
                  Outfit Recommendation
                </h2>
                <p
                  className="text-base leading-relaxed"
                  style={{ color: "var(--foreground)" }}
                >
                  {rec!.outfit}
                </p>
                {rec!.reasoning && (
                  <>
                    <h3
                      className="text-xs font-semibold uppercase tracking-widest pt-1"
                      style={{ color: "var(--foreground)", opacity: 0.4 }}
                    >
                      Reasoning
                    </h3>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--foreground)", opacity: 0.7 }}
                    >
                      {rec!.reasoning}
                    </p>
                  </>
                )}
              </div>

              {/* ── Follow-Up Input ── */}
              <div
                className="rounded-2xl p-4"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--card-border)",
                }}
              >
                <p
                  className="text-xs font-semibold uppercase tracking-widest mb-2"
                  style={{ color: "var(--foreground)", opacity: 0.4 }}
                >
                  Follow Up
                  {dailyLimits && (
                    <span style={{ opacity: 0.7, fontWeight: "normal", textTransform: "none" }}>
                      {" "}
                      — {dailyLimits.followUps.used}/
                      {dailyLimits.followUps.limit === Infinity
                        ? "∞"
                        : dailyLimits.followUps.limit}{" "}
                      used today
                    </span>
                  )}
                </p>
                <form onSubmit={handleFollowUp} className="flex gap-2">
                  <input
                    type="text"
                    value={followUpText}
                    onChange={(e) => setFollowUpText(e.target.value)}
                    placeholder="e.g. what if I need to wear shoes?"
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{
                      background: "var(--background)",
                      color: "var(--foreground)",
                      border: "1px solid var(--card-border)",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={followUpLoading || !followUpText.trim()}
                    className="rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-40"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    {followUpLoading ? "…" : "Ask"}
                  </button>
                </form>
                {followUpError && (
                  <p className="text-xs text-red-500 mt-2">{followUpError}</p>
                )}
              </div>

              {/* Refresh */}
              <button
                onClick={() => location && handleLocationResolved(location)}
                className="w-full rounded-2xl py-3 text-sm font-medium transition-opacity hover:opacity-80"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--card-border)",
                  color: "var(--foreground)",
                }}
              >
                🔄 Refresh
              </button>
            </>
          )}

          {/* ── Plan & Credits Card ── */}
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2
                  className="text-sm font-semibold"
                  style={{ color: "var(--foreground)" }}
                >
                  {isPro ? "⭐ Pro Plan" : "Free Plan"}
                </h2>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--foreground)", opacity: 0.5 }}
                >
                  {isPro ? "A$4/month" : "A$0 — free forever"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isPro && creditsRemaining !== null && (
                  <span
                    className="rounded-full px-3 py-1 text-xs font-medium"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    {creditsRemaining} credits
                  </span>
                )}
                {!isPro && (
                  <a
                    href="https://buymeacoffee.com/coolmanyt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    ☕ Upgrade to Pro
                  </a>
                )}
              </div>
            </div>

            {/* Daily limits info */}
            {dailyLimits && !isPro && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  {
                    label: "AI uses",
                    used: dailyLimits.ai.used,
                    limit: dailyLimits.ai.limit,
                  },
                  {
                    label: "Follow-ups",
                    used: dailyLimits.followUps.used,
                    limit: dailyLimits.followUps.limit,
                  },
                  {
                    label: "Closet uses",
                    used: dailyLimits.closet.used,
                    limit: dailyLimits.closet.limit,
                  },
                  {
                    label: "Source picks",
                    used: dailyLimits.sourcePicks.used,
                    limit: dailyLimits.sourcePicks.limit,
                  },
                ].map(({ label, used, limit }) => (
                  <div
                    key={label}
                    className="rounded-xl p-2 text-center"
                    style={{ background: "var(--background)" }}
                  >
                    <p
                      className="text-xs"
                      style={{ color: "var(--foreground)", opacity: 0.45 }}
                    >
                      {label}
                    </p>
                    <p
                      className="text-sm font-medium"
                      style={{
                        color:
                          used >= limit ? "#ff3b30" : "var(--foreground)",
                      }}
                    >
                      {used}/{limit === Infinity ? "∞" : limit}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Account Settings ── */}
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
            }}
          >
            <h2
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--foreground)", opacity: 0.4 }}
            >
              Account
            </h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span
                  className="text-sm"
                  style={{ color: "var(--foreground)" }}
                >
                  {userName}
                </span>
                <span
                  className="text-xs"
                  style={{ color: "var(--foreground)", opacity: 0.5 }}
                >
                  {userEmail}
                </span>
              </div>
              <p
                className="text-xs"
                style={{ color: "var(--foreground)", opacity: 0.4 }}
              >
                You can add a GitHub or Google account to your profile by
                signing in with that provider.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer
        className="px-6 py-6 text-center text-xs space-y-2"
        style={{ color: "var(--foreground)", opacity: 0.3 }}
      >
        <p>© {new Date().getFullYear()} Sky Style</p>
        <p>
          Weather data:{" "}
          {Object.entries(SOURCE_LINKS).map(([name, link], i) => (
            <span key={name}>
              {i > 0 && " · "}
              <a href={link} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: "var(--foreground)" }}>{name}</a>
            </span>
          ))}
        </p>
        <p>
          AI:{" "}
          <a href="https://openai.com/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: "var(--foreground)" }}>OpenAI</a>
          {" · "}
          <a href="https://deepmind.google/technologies/gemini/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: "var(--foreground)" }}>Google Gemini</a>
          {" · Geocoding: "}
          <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: "var(--foreground)" }}>OSM Nominatim</a>
          {" · Hosted on "}
          <a href="https://vercel.com/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: "var(--foreground)" }}>Vercel</a>
        </p>
        <p>
          <Link
            href="https://github.com/COOLmanYT/what2wear"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-70"
            style={{ color: "var(--foreground)" }}
          >
            View on GitHub
          </Link>
          {" · "}
          <Link href="/terms" className="underline hover:opacity-70" style={{ color: "var(--foreground)" }}>
            Terms
          </Link>
          {" · "}
          <Link href="/privacy" className="underline hover:opacity-70" style={{ color: "var(--foreground)" }}>
            Privacy
          </Link>
        </p>
      </footer>
    </div>
  );
}

function weatherEmoji(description: string, isDay: boolean): string {
  const d = description.toLowerCase();
  if (d.includes("thunder")) return "⛈️";
  if (d.includes("snow")) return "❄️";
  if (d.includes("rain") || d.includes("drizzle")) return "🌧️";
  if (d.includes("cloud") || d.includes("overcast")) return isDay ? "⛅" : "☁️";
  if (d.includes("fog") || d.includes("mist") || d.includes("haze")) return "🌫️";
  if (d.includes("wind")) return "💨";
  return isDay ? "☀️" : "🌙";
}
