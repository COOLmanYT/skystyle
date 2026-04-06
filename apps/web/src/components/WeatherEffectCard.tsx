"use client";

export type WeatherCondition = "thunder" | "rain" | "snow" | "sunny" | "fog" | "cloudy" | "default";

/** Max hourly forecast entries to display. */
export const HOURLY_FORECAST_LIMIT = 24;

/** Format an hourly time string for display in the user's local timezone. */
export function formatHourlyTime(time: string): string {
  // UTC or timezone-aware ISO strings (e.g. Pirate Weather .toISOString()): convert to local tz
  if (time.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(time)) {
    return new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  // Local time strings without timezone — already in the queried location's local time
  if (time.includes("T")) return time.split("T")[1].slice(0, 5);
  if (time.includes(" ")) return time.split(" ")[1].slice(0, 5);
  return time.slice(0, 5);
}

/**
 * Returns true if the hourly entry time is current or in the future.
 * Allows a 30-minute grace window so the current hour is always included.
 */
export function isHourlyCurrentOrFuture(time: string): boolean {
  const threshold = Date.now() - 30 * 60 * 1000;
  let ts: number;
  if (time.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(time)) {
    ts = new Date(time).getTime();
  } else if (time.includes("T")) {
    // No timezone suffix — treat as local time (browser tz), which matches Open-Meteo tz=auto
    ts = new Date(time).getTime();
  } else if (time.includes(" ")) {
    ts = new Date(time.replace(" ", "T")).getTime();
  } else {
    return true; // bare time string with no date — can't filter
  }
  return !isNaN(ts) && ts >= threshold;
}

/** Classify a weather description string into a visual condition. */
export function getWeatherCondition(description: string): WeatherCondition {
  const d = description.toLowerCase();
  if (d.includes("thunder") || d.includes("storm")) return "thunder";
  if (d.includes("snow") || d.includes("sleet") || d.includes("blizzard") || d.includes("ice"))
    return "snow";
  if (d.includes("rain") || d.includes("drizzle") || d.includes("shower"))
    return "rain";
  if (d.includes("fog") || d.includes("mist") || d.includes("haze")) return "fog";
  if (d.includes("cloud") || d.includes("overcast")) return "cloudy";
  if (d.includes("sunny") || d.includes("clear")) return "sunny";
  return "default";
}

/** Deterministic pseudo-random from seed (0-1 range), using a simple LCG hash. */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49999;
  return x - Math.floor(x);
}

function buildParticles(condition: WeatherCondition) {
  const count =
    condition === "thunder" ? 22
    : condition === "rain" ? 18
    : condition === "snow" ? 14
    : condition === "fog" ? 10
    : condition === "cloudy" ? 14
    : condition === "default" ? 5
    : 6; // sunny

  return Array.from({ length: count }, (_, i) => {
    const r1 = seededRandom(i + 1);
    const r2 = seededRandom(i + 100);
    const r3 = seededRandom(i + 200);
    const left = `${(i / count) * 100 + r1 * (100 / count)}%`;
    const delay = condition === "cloudy" ? `${(r2 * 5).toFixed(1)}s` : `${(r2 * 2).toFixed(1)}s`;
    const duration =
      condition === "thunder"
        ? `${0.35 + r3 * 0.3}s`
        : condition === "rain"
          ? `${0.5 + r3 * 0.4}s`
          : condition === "snow"
            ? `${3 + r3 * 2}s`
            : condition === "fog"
              ? `${4 + r3 * 3}s`
              : condition === "cloudy"
                ? `${6 + r3 * 4}s`
                : condition === "default"
                  ? `${5 + r3 * 3}s`
                  : `${2 + r3 * 1}s`; // sunny
    return { left, delay, duration, key: i };
  });
}

const WIND_LEAF_THRESHOLD = 20; // km/h — below this no leaves are shown
const MAX_LEAVES = 12; // maximum number of leaf particles
const BASE_LEAF_COUNT = 8; // starting leaf count at threshold
const LEAF_INCREMENT_FACTOR = 0.1; // additional leaves per km/h above threshold

function buildWindLeaves(windSpeed: number) {
  if (windSpeed <= WIND_LEAF_THRESHOLD) return null;
  const count = Math.min(MAX_LEAVES, Math.floor(BASE_LEAF_COUNT + (windSpeed - WIND_LEAF_THRESHOLD) * LEAF_INCREMENT_FACTOR));
  const baseDuration = Math.max(1.5, 4 - (windSpeed - WIND_LEAF_THRESHOLD) * 0.06);
  return Array.from({ length: count }, (_, i) => {
    const r1 = seededRandom(i + 500);
    const r2 = seededRandom(i + 600);
    const r3 = seededRandom(i + 700);
    const top = `${r1 * 90}%`;
    const delay = `${(r2 * 3).toFixed(1)}s`;
    const duration = `${baseDuration + r3 * 0.8}s`;
    return { top, delay, duration, key: i };
  });
}

interface WeatherEffectCardProps {
  condition: WeatherCondition;
  windSpeed?: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/** A card wrapper that renders subtle animated weather effects on its background. */
export default function WeatherEffectCard({
  condition,
  windSpeed = 0,
  children,
  className = "",
  style,
}: WeatherEffectCardProps) {
  const particles = buildParticles(condition);
  const windLeaves = buildWindLeaves(windSpeed);

  const overlayClass =
    condition === "thunder"
      ? "weather-overlay-thunder"
      : condition === "rain"
        ? "weather-overlay-rain"
        : condition === "snow"
          ? "weather-overlay-snow"
          : condition === "sunny"
            ? "weather-overlay-sunny"
            : condition === "fog"
              ? "weather-overlay-fog"
              : condition === "cloudy"
                ? "weather-overlay-cloudy"
                : condition === "default"
                  ? "weather-overlay-default"
                  : "";

  return (
    <div className={`${className} weather-card weather-card-${condition}`} style={{ ...style, position: "relative", overflow: "hidden" }}>
      {/* Tinted background overlay — decorative */}
      {condition !== "default" && <div className={`weather-tint weather-tint-${condition}`} aria-hidden="true" />}

      {/* Animated particles — decorative */}
      {particles && (
        <div className={`weather-particles ${overlayClass}`} aria-hidden="true">
          {particles.map((p) => (
            <span
              key={p.key}
              className="weather-particle"
              style={{
                left: p.left,
                animationDelay: p.delay,
                animationDuration: p.duration,
              }}
            />
          ))}
        </div>
      )}

      {/* Wind leaf overlay — decorative */}
      {windLeaves && (
        <div className="weather-particles weather-overlay-wind" aria-hidden="true">
          {windLeaves.map((l) => (
            <span
              key={l.key}
              className="weather-leaf"
              style={{
                top: l.top,
                animationDelay: l.delay,
                animationDuration: l.duration,
              }}
            />
          ))}
        </div>
      )}

      {/* Card content */}
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}
