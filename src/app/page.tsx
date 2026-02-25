"use client";

import { useState } from "react";
import DemoLocationPicker, { ResolvedLocation } from "@/components/DemoLocationPicker";
import Link from "next/link";

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
  source: "BOM" | "OpenWeather" | "Custom";
}

const ACCURACY_COLOR: Record<string, string> = {
  High: "#34c759",
  Medium: "#ff9500",
  Low: "#ff3b30",
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
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌤️</span>
          <span className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            Sky Style
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a href="#demo" className="text-sm px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70" style={{ color: "var(--foreground)" }}>
            Demo
          </a>
          <a href="#pricing" className="text-sm px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70" style={{ color: "var(--foreground)" }}>
            Pricing
          </a>
          <Link
            href="/login"
            className="text-sm px-4 py-2 rounded-xl font-medium transition-opacity hover:opacity-80"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Sign In
          </Link>
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
            className="px-6 py-3 rounded-2xl text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Get Started — Free
          </Link>
          <a
            href="#demo"
            className="px-6 py-3 rounded-2xl text-sm font-medium transition-opacity hover:opacity-80"
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
      <section id="demo" className="px-6 py-16 max-w-lg mx-auto">
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

                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { label: "Humidity", value: `${weather.humidity}%` },
                    { label: "Rain chance", value: `${weather.rainChance}%` },
                    {
                      label: "Wind",
                      value: `${weather.windSpeed}km/h ${weather.windDir}`,
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-xl p-2.5 text-center"
                      style={{ background: "var(--background)" }}
                    >
                      <p
                        className="text-xs"
                        style={{ color: "var(--foreground)", opacity: 0.45 }}
                      >
                        {label}
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
                  </span>
                </div>

                {weather.alerts.length > 0 && (
                  <div
                    className="rounded-xl p-3 text-xs space-y-1"
                    style={{
                      background: "#ff950022",
                      border: "1px solid #ff950040",
                    }}
                  >
                    {weather.alerts.map((a, i) => (
                      <p key={i} style={{ color: "#ff9500" }}>
                        ⚠️ {a}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* AI recommendation — demo placeholder */}
              <div
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
                  className="inline-block mt-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  Sign in for AI recommendations →
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-16 max-w-3xl mx-auto">
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Free */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
            }}
          >
            <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>
              Free
            </h3>
            <p className="text-3xl font-bold mb-4" style={{ color: "var(--foreground)" }}>
              A$0
            </p>
            <ul className="text-sm space-y-2" style={{ color: "var(--foreground)", opacity: 0.7 }}>
              <li>✅ AI outfit recommendations</li>
              <li>✅ Real-time weather data</li>
              <li>✅ GPS &amp; manual location</li>
              <li>✅ Metric units</li>
            </ul>
          </div>

          {/* Monthly */}
          <div
            className="rounded-2xl p-6 relative"
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
            <ul className="text-sm space-y-2 mt-4" style={{ color: "var(--foreground)", opacity: 0.7 }}>
              <li>✅ Everything in Free</li>
              <li>✅ 50 credits per week</li>
              <li>✅ Custom AI prompts</li>
              <li>✅ Imperial units</li>
              <li>✅ Custom weather sources</li>
            </ul>
          </div>

          {/* Lifetime */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
            }}
          >
            <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>
              Pro Lifetime
            </h3>
            <p className="text-3xl font-bold mb-1" style={{ color: "var(--foreground)" }}>
              A$30<span className="text-sm font-normal opacity-60"> once</span>
            </p>
            <ul className="text-sm space-y-2 mt-4" style={{ color: "var(--foreground)", opacity: 0.7 }}>
              <li>✅ Everything in Pro</li>
              <li>✅ One-time payment</li>
              <li>✅ Lifetime updates</li>
              <li>✅ Priority support</li>
            </ul>
          </div>
        </div>
      </section>

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
          className="inline-block px-6 py-3 rounded-2xl text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Get Started — It&apos;s Free
        </Link>
      </section>

      {/* Footer */}
      <footer
        className="px-6 py-6 text-center text-xs"
        style={{ color: "var(--foreground)", opacity: 0.3 }}
      >
        © {new Date().getFullYear()} Sky Style. Built with Next.js, Supabase &amp; OpenAI.
      </footer>
    </div>
  );
}
