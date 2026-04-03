"use client";

import { useState, useEffect } from "react";
import DemoLocationPicker, { ResolvedLocation } from "@/components/DemoLocationPicker";
import WeatherEffectCard, { getWeatherCondition, formatHourlyTime, isHourlyCurrentOrFuture, HOURLY_FORECAST_LIMIT } from "@/components/WeatherEffectCard";
import Link from "next/link";

/** Returns true if semver string `a` is strictly greater than `b`. */
function isVersionGreater(a: string, b: string): boolean {
  const parse = (v: string) => v.split(".").map(Number);
  const [aMaj = 0, aMin = 0, aPatch = 0] = parse(a);
  const [bMaj = 0, bMin = 0, bPatch = 0] = parse(b);
  if (aMaj !== bMaj) return aMaj > bMaj;
  if (aMin !== bMin) return aMin > bMin;
  return aPatch > bPatch;
}

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

interface HourlyForecast {
  time: string;
  temp: number;
  description: string;
  rainChance: number;
  windSpeed: number;
}

interface WeatherData {
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

export default function Home() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<ResolvedLocation | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [changelog, setChangelog] = useState<{ date: string; version: string; title: string; description: string }[]>([]);
  const [changelogUnread, setChangelogUnread] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => setIsLoggedIn(!!data?.user))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/changelog")
      .then((r) => r.json())
      .then((data: { date: string; version: string; title: string; description: string }[]) => {
        setChangelog(data);
        if (data.length > 0) {
          try {
            const seen = localStorage.getItem("skystyle_last_seen_changelog");
            const latest = data[0].version;
            if (!seen || isVersionGreater(latest, seen)) {
              setChangelogUnread(true);
            }
          } catch { /* ignore */ }
        }
      })
      .catch(() => {});
  }, []);

  async function handleLocationResolved(loc: ResolvedLocation) {
    setLocation(loc);
    setError(null);
    setWeather(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/demo/weather?lat=${loc.lat}&lon=${loc.lon}`);
      if (!res.ok) {
        let errorMessage = "Something went wrong.";
        try {
          const data = await res.json();
          errorMessage = data.error ?? errorMessage;
        } catch { /* non-JSON error response */ }
        setError(errorMessage);
      } else {
        const data = await res.json();
        setWeather(data as WeatherData);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Navigation */}
      <nav className="sticky-nav">
        <div className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2 btn-interact cursor-pointer"
            aria-label="Scroll to top"
          >
            <span className="text-2xl">🌤️</span>
            <span className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              Sky Style
            </span>
          </button>
          <div className="flex items-center gap-3">
            <a href="#demo" className="text-sm px-3 py-1.5 rounded-lg btn-interact" style={{ color: "var(--foreground)" }}>
              Demo
            </a>
            <a href="#pricing" className="text-sm px-3 py-1.5 rounded-lg btn-interact" style={{ color: "var(--foreground)" }}>
              Pricing
            </a>
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="text-sm px-4 py-2 rounded-xl font-medium btn-interact"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="text-sm px-4 py-2 rounded-xl font-medium btn-interact"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 pt-16 pb-20 text-center max-w-3xl mx-auto">
        <div className="text-6xl mb-6">🌤️</div>
        <h1
          className="text-4xl sm:text-5xl font-bold mb-4 leading-tight"
          style={{ color: "var(--foreground)" }}
        >
          Dress perfectly for&nbsp;the&nbsp;weather
        </h1>
        <p
          className="text-lg mb-8 max-w-xl mx-auto"
          style={{ color: "var(--foreground)", opacity: 0.6 }}
        >
          Sky Style combines hyper-local weather data with AI to recommend the
          perfect outfit every day. Never overdress or underdress again.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/login"
            className="px-6 py-3 rounded-2xl text-sm font-medium btn-interact"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Get Started — Free
          </Link>
          <a
            href="#demo"
            className="px-6 py-3 rounded-2xl text-sm font-medium btn-interact"
            style={{
              background: "var(--card)",
              color: "var(--foreground)",
              border: "1px solid var(--card-border)",
            }}
          >
            Try Live Demo
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <h2
          className="text-2xl font-semibold text-center mb-10"
          style={{ color: "var(--foreground)" }}
        >
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              emoji: "📍",
              title: "Share your location",
              desc: "Use GPS or enter any city. We find the nearest weather station for accurate data.",
            },
            {
              emoji: "🌡️",
              title: "Real-time weather",
              desc: "We pull hyper-local weather from the Bureau of Meteorology (Australia) or OpenWeatherMap.",
            },
            {
              emoji: "✨",
              title: "AI outfit advice",
              desc: "Our AI stylist analyses conditions — temperature, rain, wind, UV — and recommends what to wear.",
            },
          ].map((step) => (
            <div
              key={step.title}
              className="rounded-2xl p-6 text-center"
              style={{
                background: "var(--card)",
                border: "1px solid var(--card-border)",
              }}
            >
              <div className="text-3xl mb-3">{step.emoji}</div>
              <h3
                className="font-semibold mb-2"
                style={{ color: "var(--foreground)" }}
              >
                {step.title}
              </h3>
              <p
                className="text-sm"
                style={{ color: "var(--foreground)", opacity: 0.6 }}
              >
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Live Demo */}
      <section id="demo" className="px-6 py-16 max-w-2xl mx-auto">
        <h2
          className="text-2xl font-semibold text-center mb-2"
          style={{ color: "var(--foreground)" }}
        >
          Live Demo
        </h2>
        <p
          className="text-sm text-center mb-8"
          style={{ color: "var(--foreground)", opacity: 0.5 }}
        >
          Try it out — pick a location to see real weather data.
        </p>

        <div className="space-y-4">
          <DemoLocationPicker onLocationResolved={handleLocationResolved} />

          {location && (
            <WeatherEffectCard
              condition={weather ? getWeatherCondition(weather.description) : "default"}
              windSpeed={weather?.windSpeed ?? 0}
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
            </WeatherEffectCard>
          )}

          {loading && (
            <div
              className="rounded-2xl p-8 flex flex-col items-center gap-3"
              style={{
                background: "var(--card)",
                border: "1px solid var(--card-border)",
              }}
            >
              <div className="text-3xl animate-bounce">🌤️</div>
              <p
                className="text-sm"
                style={{ color: "var(--foreground)", opacity: 0.6 }}
              >
                Fetching weather data…
              </p>
            </div>
          )}

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

          {weather && !loading && (
            <>
              {/* Weather card */}
              <WeatherEffectCard
                condition={getWeatherCondition(weather.description)}
                windSpeed={weather.windSpeed}
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
                      {weather.temp}°C
                    </p>
                    <p
                      className="text-sm capitalize mt-0.5"
                      style={{ color: "var(--foreground)", opacity: 0.55 }}
                    >
                      {weather.description} · feels like {weather.feelsLike}°C
                    </p>
                  </div>
                  <span className="text-4xl">
                    {weatherEmoji(weather.description, weather.isDay)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {[
                    { label: "Humidity", value: `${weather.humidity}%`, icon: "💧" },
                    { label: "Rain chance", value: `${weather.rainChance}%`, icon: "🌧" },
                    { label: "Wind", value: `${weather.windSpeed}km/h ${weather.windDir}`, icon: "💨" },
                    { label: "UV Index", value: `${weather.uvIndex}`, icon: "☀️" },
                    { label: "Feels like", value: `${weather.feelsLike}°C`, icon: "🌡️" },
                    { label: "Time", value: weather.isDay ? "Daytime" : "Night-time", icon: weather.isDay ? "🌞" : "🌙" },
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

                {/* Alerts */}
                {weather.alerts.length > 0 && (
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
                    {weather.alerts.map((a, i) => (
                      <p key={i} style={{ color: "#ff9500" }}>
                        {a}
                      </p>
                    ))}
                  </div>
                )}

                {/* Per-source breakdown */}
                {weather.sources && weather.sources.length > 1 && (
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
                            <th className="text-right py-1 px-1">Hum.</th>
                            <th className="text-right py-1 px-1">Wind</th>
                            <th className="text-right py-1 px-1">Rain</th>
                            <th className="text-right py-1 px-1">UV</th>
                          </tr>
                        </thead>
                        <tbody>
                          {weather.sources.map((s) => (
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
                              <td className="text-right py-1 px-1">{s.temp}°C</td>
                              <td className="text-right py-1 px-1">{s.humidity}%</td>
                              <td className="text-right py-1 px-1">{s.windSpeed}km/h {s.windDir}</td>
                              <td className="text-right py-1 px-1">{s.rainChance}%</td>
                              <td className="text-right py-1 px-1">{s.uvIndex}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Hourly forecast */}
                {weather.hourly && weather.hourly.length > 0 && (
                  <div className="pt-2">
                    <p
                      className="text-xs font-semibold uppercase tracking-widest mb-2"
                      style={{ color: "var(--foreground)", opacity: 0.4 }}
                    >
                      Hourly Forecast
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {weather.hourly.filter(h => isHourlyCurrentOrFuture(h.time)).slice(0, HOURLY_FORECAST_LIMIT).map((h, i) => (
                        <div
                          key={i}
                          className="flex-shrink-0 rounded-xl p-2 text-center min-w-[72px]"
                          style={{ background: "var(--background)" }}
                        >
                          <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.5 }}>
                            {formatHourlyTime(h.time)}
                          </p>
                          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                            {h.temp}°
                          </p>
                          <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                            🌧{h.rainChance}%
                          </p>
                          <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.35 }}>
                            💨{h.windSpeed}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{
                      background: ACCURACY_COLOR[weather.accuracyScore],
                    }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: "var(--foreground)", opacity: 0.5 }}
                  >
                    {weather.accuracyScore} accuracy · {weather.stationName} (
                    {weather.stationDistanceKm} km) · {weather.source}
                    {weather.sources && weather.sources.length > 1 && (
                      <> — averaged from {weather.sources.length} sources</>
                    )}
                  </span>
                </div>

                {/* Attribution */}
                <div
                  className="rounded-xl p-3"
                  style={{ background: "var(--background)" }}
                >
                  <p
                    className="text-xs font-semibold uppercase tracking-widest mb-1"
                    style={{ color: "var(--foreground)", opacity: 0.4 }}
                  >
                    Data Sources &amp; Credits
                  </p>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "var(--foreground)", opacity: 0.5 }}
                  >
                    Weather from{" "}
                    {[...new Set([
                      ...(weather.sources ?? []).map((s) => s.source),
                      ...(weather.sources ? [] : [weather.source]),
                    ])]
                      .map((name) => {
                        const link = SOURCE_LINKS[name];
                        return link ? (
                          <a key={name} href={link} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: "var(--accent)" }}>{name}</a>
                        ) : (
                          <span key={name}>{name}</span>
                        );
                      })
                      .reduce<React.ReactNode[]>((acc, el, i) => {
                        if (i > 0) acc.push(<span key={`sep-${i}`}>, </span>);
                        acc.push(el);
                        return acc;
                      }, [])}
                    . Geocoding by{" "}
                    <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: "var(--accent)" }}>OSM Nominatim</a>.
                  </p>
                </div>
              </WeatherEffectCard>

              {/* AI recommendation — demo placeholder */}
              <WeatherEffectCard
                condition={getWeatherCondition(weather.description)}
                windSpeed={weather.windSpeed}
                className="rounded-2xl p-5 space-y-3"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--card-border)",
                }}
              >
                <h3
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--accent)" }}
                >
                  Outfit Recommendation
                </h3>
                <p
                  className="text-base leading-relaxed"
                  style={{ color: "var(--foreground)" }}
                >
                  This is a demo!
                </p>
                <p
                  className="text-sm"
                  style={{ color: "var(--foreground)", opacity: 0.5 }}
                >
                  Sign in to get personalised AI-powered outfit recommendations
                  based on this weather data.
                </p>
                <Link
                  href="/login"
                  className="inline-block mt-2 px-5 py-2.5 rounded-xl text-sm font-medium btn-interact"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  Sign in for AI recommendations →
                </Link>
              </WeatherEffectCard>
            </>
          )}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-16 max-w-6xl mx-auto">
        <h2
          className="text-2xl font-semibold text-center mb-2"
          style={{ color: "var(--foreground)" }}
        >
          Pricing
        </h2>
        <p
          className="text-sm text-center mb-10"
          style={{ color: "var(--foreground)", opacity: 0.5 }}
        >
          Start free, upgrade when you need more.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
          {/* Free */}
          <div
            className="rounded-2xl p-8"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
            }}
          >
            <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>
              Free
            </h3>
            <p className="text-3xl font-bold mb-6" style={{ color: "var(--foreground)" }}>
              A$0
            </p>
            <ul className="text-sm space-y-3" style={{ color: "var(--foreground)", opacity: 0.7 }}>
              <li>✅ 5 AI recommendations/day</li>
              <li>✅ 10 follow-ups/day</li>
              <li>✅ Real-time multi-source weather</li>
              <li>✅ Closet (1 use/day)</li>
              <li>✅ Source picker (1/day)</li>
              <li>✅ GPS &amp; manual location</li>
            </ul>
          </div>

          {/* Monthly */}
          <div
            className="rounded-2xl p-8 relative"
            style={{
              background: "var(--card)",
              border: "2px solid var(--accent)",
            }}
          >
            <span
              className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-medium px-3 py-1 rounded-full"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              Popular
            </span>
            <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>
              Pro Monthly
            </h3>
            <p className="text-3xl font-bold mb-1" style={{ color: "var(--foreground)" }}>
              A$4<span className="text-sm font-normal opacity-60">/month</span>
            </p>
            <ul className="text-sm space-y-3 mt-6" style={{ color: "var(--foreground)", opacity: 0.7 }}>
              <li>✅ Everything in Free</li>
              <li>✅ 50 credits per week</li>
              <li>✅ 100 follow-ups/day</li>
              <li>✅ Unlimited closet &amp; sources</li>
              <li>✅ Custom AI prompts</li>
              <li>✅ Bring your own AI key</li>
              <li>✅ Custom weather sources</li>
            </ul>
          </div>

          {/* Pay As You Go */}
          <div
            className="rounded-2xl p-8 relative"
            style={{
              background: "var(--card)",
              border: "1px dashed var(--card-border)",
              opacity: 0.75,
            }}
          >
            <span
              className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-medium px-3 py-1 rounded-full"
              style={{ background: "var(--foreground)", color: "var(--background)", opacity: 0.6 }}
            >
              Coming one day
            </span>
            <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>
              Pay As You Go
            </h3>
            <p className="text-3xl font-bold mb-1" style={{ color: "var(--foreground)" }}>
              A$?<span className="text-sm font-normal opacity-60">/use</span>
            </p>
            <ul className="text-sm space-y-3 mt-6" style={{ color: "var(--foreground)", opacity: 0.7 }}>
              <li>💡 Select what you want</li>
              <li>💰 Pay only for what you use</li>
              <li>🚫 No more overpaying</li>
              <li>⚡ Priority support</li>
              <li>📸 Image Upload add-on</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Changelog Section */}
      {changelog.length > 0 && (
        <section className="px-6 py-12 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
              Latest from our changelog
              {changelogUnread && (
                <span
                  className="ml-2 inline-block align-middle"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#ff3b30",
                    display: "inline-block",
                    verticalAlign: "middle",
                  }}
                  aria-label="New updates"
                />
              )}
            </h2>
            <Link
              href="/changelog"
              className="text-xs btn-interact rounded-xl px-3 py-1.5"
              style={{ color: "var(--accent)" }}
              onClick={() => {
                setChangelogUnread(false);
                try { localStorage.setItem("skystyle_last_seen_changelog", changelog[0].version); } catch { /* ignore */ }
              }}
            >
              View all →
            </Link>
          </div>

          {/* Vertical timeline */}
          <div className="relative">
            <div
              className="absolute left-[7px] top-3"
              style={{
                width: 2,
                bottom: 8,
                background: "var(--card-border)",
                willChange: "auto",
              }}
              aria-hidden="true"
            />
            <div className="space-y-6">
              {changelog.slice(0, 5).map((entry, i) => (
                <div key={entry.version} className="relative flex gap-5">
                  <div
                    className="relative z-10 mt-1 flex-shrink-0"
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: i === 0 ? "var(--accent)" : "var(--card-border)",
                      boxShadow: i === 0 ? "0 0 0 3px var(--background), 0 0 0 5px var(--accent)" : "0 0 0 3px var(--background)",
                    }}
                    aria-hidden="true"
                  />
                  <div
                    className="flex-1 rounded-2xl p-4 space-y-1"
                    style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
                  >
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
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      {entry.title}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--foreground)", opacity: 0.65 }}>
                      {entry.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer CTA */}
      <section className="px-6 py-16 text-center">
        <h2
          className="text-2xl font-semibold mb-4"
          style={{ color: "var(--foreground)" }}
        >
          Ready to dress smarter?
        </h2>
        <Link
          href="/login"
          className="inline-block px-6 py-3 rounded-2xl text-sm font-medium btn-interact"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Get Started — It&apos;s Free
        </Link>
      </section>

      {/* Footer */}
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
          {" · Built with "}
          <a href="https://nextjs.org/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: "var(--foreground)" }}>Next.js</a>
          {", "}
          <a href="https://supabase.com/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: "var(--foreground)" }}>Supabase</a>
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
            GitHub
          </Link>
          {" · "}
          <Link
            href="/changelog"
            className="underline hover:opacity-70 inline-flex items-center gap-1"
            style={{ color: "var(--foreground)" }}
            onClick={() => {
              setChangelogUnread(false);
              if (changelog.length > 0) {
                try { localStorage.setItem("skystyle_last_seen_changelog", changelog[0].version); } catch { /* ignore */ }
              }
            }}
          >
            Changelog
            {changelogUnread && (
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#ff3b30",
                  flexShrink: 0,
                  verticalAlign: "middle",
                  marginBottom: 1,
                }}
                aria-label="New updates"
              />
            )}
          </Link>
          {" · "}
          <Link href="/terms" className="underline hover:opacity-70" style={{ color: "var(--foreground)" }}>
            Terms of Service
          </Link>
          {" · "}
          <Link href="/privacy" className="underline hover:opacity-70" style={{ color: "var(--foreground)" }}>
            Privacy Policy
          </Link>
        </p>
      </footer>
    </div>
  );
}
