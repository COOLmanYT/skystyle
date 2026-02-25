"use client";

import { useState } from "react";
import LocationPicker, { ResolvedLocation } from "./LocationPicker";

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
    source: "BOM" | "OpenWeather" | "Custom";
  };
  recommendation: {
    outfit: string;
    reasoning: string;
  };
  meta: {
    isPro: boolean;
    unitPreference: "metric" | "imperial";
    creditsRemaining: number | null;
  };
}

const ACCURACY_COLOR: Record<string, string> = {
  High: "#34c759",
  Medium: "#ff9500",
  Low: "#ff3b30",
};

export default function Dashboard({ userName }: { userName: string }) {
  const [location, setLocation] = useState<ResolvedLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StyleResponse | null>(null);

  async function handleLocationResolved(loc: ResolvedLocation) {
    setLocation(loc);
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: loc.lat, lon: loc.lon }),
      });
      if (!res.ok) {
        let errorMessage = "Something went wrong.";
        try {
          const data = await res.json();
          errorMessage = data.error ?? errorMessage;
        } catch { /* non-JSON error response */ }
        setError(errorMessage);
      } else {
        const data = await res.json();
        setResult(data as StyleResponse);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  const w = result?.weather;
  const rec = result?.recommendation;
  const meta = result?.meta;

  return (
    <div className="min-h-screen px-4 py-10" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-lg space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--foreground)" }}>
              🌤️ Sky Style
            </h1>
            <p className="text-sm" style={{ color: "var(--foreground)", opacity: 0.5 }}>
              Good day, {userName}
            </p>
          </div>
          {meta?.isPro && meta.creditsRemaining !== null && (
            <span
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {meta.creditsRemaining} credits
            </span>
          )}
        </div>

        {/* Location Picker */}
        <LocationPicker onLocationResolved={handleLocationResolved} />

        {/* Active location pill */}
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

        {/* Loading */}
        {loading && (
          <div
            className="rounded-2xl p-8 flex flex-col items-center gap-3"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
          >
            <div className="text-3xl animate-bounce">✨</div>
            <p className="text-sm" style={{ color: "var(--foreground)", opacity: 0.6 }}>
              Fetching weather &amp; styling your look…
            </p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div
            className="rounded-2xl p-4 text-sm"
            style={{ background: "#ff3b3015", border: "1px solid #ff3b3040", color: "#ff3b30" }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            {/* Weather card */}
            <div
              className="rounded-2xl p-5 space-y-3"
              style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-4xl font-thin" style={{ color: "var(--foreground)" }}>
                    {meta?.unitPreference === "imperial"
                      ? `${Math.round((w!.temp * 9) / 5 + 32)}°F`
                      : `${w!.temp}°C`}
                  </p>
                  <p className="text-sm capitalize mt-0.5" style={{ color: "var(--foreground)", opacity: 0.55 }}>
                    {w!.description} · feels like{" "}
                    {meta?.unitPreference === "imperial"
                      ? `${Math.round((w!.feelsLike * 9) / 5 + 32)}°F`
                      : `${w!.feelsLike}°C`}
                  </p>
                </div>
                <span className="text-4xl">{weatherEmoji(w!.description, w!.isDay)}</span>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { label: "Humidity", value: `${w!.humidity}%` },
                  { label: "Rain chance", value: `${w!.rainChance}%` },
                  {
                    label: "Wind",
                    value: `${
                      meta?.unitPreference === "imperial"
                        ? `${Math.round(w!.windSpeed * 0.621)}mph`
                        : `${w!.windSpeed}km/h`
                    } ${w!.windDir}`,
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl p-2.5 text-center"
                    style={{ background: "var(--background)" }}
                  >
                    <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.45 }}>
                      {label}
                    </p>
                    <p className="text-sm font-medium mt-0.5" style={{ color: "var(--foreground)" }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Accuracy badge */}
              <div className="flex items-center gap-2 pt-1">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: ACCURACY_COLOR[w!.accuracyScore] }}
                />
                <span className="text-xs" style={{ color: "var(--foreground)", opacity: 0.5 }}>
                  {w!.accuracyScore} accuracy · {w!.stationName} ({w!.stationDistanceKm} km) · {w!.source}
                </span>
              </div>

              {/* Alerts */}
              {w!.alerts.length > 0 && (
                <div className="rounded-xl p-3 text-xs space-y-1" style={{ background: "#ff9500" + "22", border: "1px solid #ff950040" }}>
                  {w!.alerts.map((a, i) => (
                    <p key={i} style={{ color: "#ff9500" }}>⚠️ {a}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Outfit recommendation card */}
            <div
              className="rounded-2xl p-5 space-y-3"
              style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
            >
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--accent)" }}>
                Outfit Recommendation
              </h2>
              <p className="text-base leading-relaxed" style={{ color: "var(--foreground)" }}>
                {rec!.outfit}
              </p>

              {rec!.reasoning && (
                <>
                  <h3 className="text-xs font-semibold uppercase tracking-widest pt-1" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                    Reasoning
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)", opacity: 0.7 }}>
                    {rec!.reasoning}
                  </p>
                </>
              )}
            </div>

            {/* Refresh button */}
            <button
              onClick={() => location && handleLocationResolved(location)}
              className="w-full rounded-2xl py-3 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: "var(--card)", border: "1px solid var(--card-border)", color: "var(--foreground)" }}
            >
              🔄 Refresh
            </button>
          </>
        )}
      </div>
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
