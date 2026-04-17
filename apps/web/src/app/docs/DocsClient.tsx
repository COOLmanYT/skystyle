"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface NavSection {
  id: string;
  label: string;
  children?: { id: string; label: string }[];
}

// ── Sidebar navigation structure ──────────────────────────────────────────────

const NAV: NavSection[] = [
  { id: "getting-started", label: "Getting Started" },
  { id: "authentication", label: "Authentication" },
  {
    id: "endpoints",
    label: "Endpoints",
    children: [
      { id: "endpoint-recommend", label: "POST /recommend" },
      { id: "endpoint-recweather", label: "POST /recweather" },
      { id: "endpoint-weather", label: "GET /weather" },
      { id: "endpoint-closet", label: "GET /closet" },
    ],
  },
  { id: "errors", label: "Error Reference" },
  { id: "credits", label: "Credits" },
];

// ── Tiny helpers ───────────────────────────────────────────────────────────────

const BASE_URL = "https://skystyle.app/api/v1";

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="relative rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: "1px solid var(--card-border)" }}>
        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--foreground)", opacity: 0.4 }}>
          {lang}
        </span>
        <button
          onClick={copy}
          className="text-[10px] btn-interact rounded-lg px-2 py-1 font-medium"
          style={{ color: "var(--foreground)", opacity: 0.55 }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-xs leading-relaxed" style={{ color: "var(--foreground)", margin: 0 }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ParamRow({ name, type, required, description }: { name: string; type: string; required: boolean; description: string }) {
  return (
    <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
      <td className="py-3 pr-4 align-top whitespace-nowrap">
        <code className="text-xs px-1.5 py-0.5 rounded-md font-mono" style={{ background: "var(--background)", color: "var(--foreground)" }}>
          {name}
        </code>
      </td>
      <td className="py-3 pr-4 align-top whitespace-nowrap">
        <span className="text-xs font-mono" style={{ color: "var(--foreground)", opacity: 0.5 }}>{type}</span>
      </td>
      <td className="py-3 pr-4 align-top whitespace-nowrap">
        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold" style={{
          background: required ? "rgba(var(--accent-rgb, 99,102,241),0.12)" : "rgba(127,127,127,0.1)",
          color: required ? "var(--accent)" : "var(--foreground)",
          opacity: required ? 1 : 0.55,
        }}>
          {required ? "required" : "optional"}
        </span>
      </td>
      <td className="py-3 align-top">
        <span className="text-xs leading-relaxed" style={{ color: "var(--foreground)", opacity: 0.7 }}>{description}</span>
      </td>
    </tr>
  );
}

function ResponseRow({ name, type, description }: { name: string; type: string; description: string }) {
  return (
    <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
      <td className="py-3 pr-4 align-top whitespace-nowrap">
        <code className="text-xs px-1.5 py-0.5 rounded-md font-mono" style={{ background: "var(--background)", color: "var(--foreground)" }}>
          {name}
        </code>
      </td>
      <td className="py-3 pr-4 align-top whitespace-nowrap">
        <span className="text-xs font-mono" style={{ color: "var(--foreground)", opacity: 0.5 }}>{type}</span>
      </td>
      <td className="py-3 align-top">
        <span className="text-xs leading-relaxed" style={{ color: "var(--foreground)", opacity: 0.7 }}>{description}</span>
      </td>
    </tr>
  );
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-xl font-bold pt-12 pb-4 scroll-mt-20"
      style={{ color: "var(--foreground)", borderBottom: "1px solid var(--card-border)" }}
    >
      {children}
    </h2>
  );
}

function SubHeading({ id, method, path, children }: { id: string; method?: string; path?: string; children?: React.ReactNode }) {
  return (
    <h3 id={id} className="text-base font-semibold pt-10 pb-3 scroll-mt-20 flex items-center gap-3 flex-wrap" style={{ color: "var(--foreground)" }}>
      {method && (
        <span
          className="text-xs font-bold px-2 py-1 rounded-lg font-mono"
          style={{ background: method === "GET" ? "rgba(52,199,89,0.15)" : "rgba(0,122,255,0.15)", color: method === "GET" ? "#34c759" : "#007aff" }}
        >
          {method}
        </span>
      )}
      {path && (
        <code className="text-sm font-mono" style={{ color: "var(--foreground)" }}>{path}</code>
      )}
      {children}
    </h3>
  );
}

function Badge({ children, color = "blue" }: { children: React.ReactNode; color?: "blue" | "green" | "red" | "orange" }) {
  const colors: Record<string, { bg: string; text: string }> = {
    blue:   { bg: "rgba(0,122,255,0.12)",   text: "#007aff" },
    green:  { bg: "rgba(52,199,89,0.12)",    text: "#34c759" },
    red:    { bg: "rgba(255,59,48,0.12)",    text: "#ff3b30" },
    orange: { bg: "rgba(255,149,0,0.12)",    text: "#ff9500" },
  };
  const c = colors[color] ?? colors.blue;
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md font-mono" style={{ background: c.bg, color: c.text }}>
      {children}
    </span>
  );
}

// ── Code example strings ───────────────────────────────────────────────────────

const AUTH_JS = `const response = await fetch("${BASE_URL}/recommend", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk_live_YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ lat: 51.5074, lon: -0.1278 }),
});

const data = await response.json();`;

const AUTH_CURL = `curl -X POST "${BASE_URL}/recommend" \\
  -H "Authorization: Bearer sk_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"lat": 51.5074, "lon": -0.1278}'`;

const RECOMMEND_JS = `const response = await fetch("${BASE_URL}/recommend", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk_live_YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    lat: 40.7128,
    lon: -74.0060,
    unit: "imperial",
    gender: "Male",
  }),
});

const data = await response.json();
// {
//   outfit: "Wear a light denim jacket over a white t-shirt…",
//   reasoning: "With 18°C temps and a light breeze…",
//   weather: { temp: 64, feels_like: 61, temp_unit: "°F", … },
//   model: "gemini-2.5-flash",
//   generated_at: "2026-04-17T12:00:00.000Z"
// }`;

const RECOMMEND_CURL = `curl -X POST "${BASE_URL}/recommend" \\
  -H "Authorization: Bearer sk_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "lat": 40.7128,
    "lon": -74.0060,
    "unit": "imperial",
    "gender": "Male"
  }'`;

const RECWEATHER_JS = `const response = await fetch("${BASE_URL}/recweather", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk_live_YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ lat: 48.8566, lon: 2.3522 }),
});

const data = await response.json();
// {
//   outfit: "…",
//   reasoning: "…",
//   weather: { temp: 14, feels_like: 11, temp_unit: "°C",
//              humidity_pct: 72, wind_speed: 18, wind_speed_unit: "km/h",
//              description: "Partly cloudy", source: "open-meteo", … },
//   model: "gemini-2.5-flash",
//   generated_at: "2026-04-17T12:00:00.000Z"
// }`;

const RECWEATHER_CURL = `curl -X POST "${BASE_URL}/recweather" \\
  -H "Authorization: Bearer sk_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"lat": 48.8566, "lon": 2.3522}'`;

const WEATHER_JS = `const response = await fetch(
  "${BASE_URL}/weather?lat=35.6762&lon=139.6503&unit=metric",
  {
    headers: { "Authorization": "Bearer sk_live_YOUR_API_KEY" },
  }
);

const data = await response.json();
// {
//   temp: 22, feels_like: 20, temp_unit: "°C",
//   humidity_pct: 68, wind_speed: 14, wind_speed_unit: "km/h",
//   wind_dir: "SE", description: "Mostly sunny",
//   rain_chance_pct: 5, uv_index: 6, is_day: true,
//   alerts: [], source: "open-meteo",
//   retrieved_at: "2026-04-17T12:00:00.000Z"
// }`;

const WEATHER_CURL = `curl "${BASE_URL}/weather?lat=35.6762&lon=139.6503&unit=metric" \\
  -H "Authorization: Bearer sk_live_YOUR_API_KEY"`;

const CLOSET_JS = `const response = await fetch("${BASE_URL}/closet", {
  headers: { "Authorization": "Bearer sk_live_YOUR_API_KEY" },
});

const data = await response.json();
// {
//   items: ["White Oxford shirt", "Navy chinos", "Brown leather belt"],
//   count: 3
// }`;

const CLOSET_CURL = `curl "${BASE_URL}/closet" \\
  -H "Authorization: Bearer sk_live_YOUR_API_KEY"`;

// ── Main component ─────────────────────────────────────────────────────────────

export default function DocsClient() {
  const [activeId, setActiveId] = useState<string>("getting-started");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const allIds = NAV.flatMap((s) => [s.id, ...(s.children?.map((c) => c.id) ?? [])]);
    const elements = allIds.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];

    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );

    for (const el of elements) observerRef.current.observe(el);
    return () => observerRef.current?.disconnect();
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* ── Top nav bar ─────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-20 px-4 py-3"
        style={{ background: "var(--background)", borderBottom: "1px solid var(--card-border)" }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              Sky Style
            </Link>
            <span style={{ color: "var(--card-border)" }}>/</span>
            <span className="text-sm" style={{ color: "var(--foreground)", opacity: 0.55 }}>API Docs</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/api"
              className="text-xs btn-interact rounded-xl px-3 py-2 font-medium"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              Get API Key
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto flex gap-0">
        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside
          className="hidden lg:block w-60 flex-shrink-0 sticky top-14 self-start h-[calc(100vh-3.5rem)] overflow-y-auto py-8 pl-4 pr-6"
        >
          <nav>
            <ul className="space-y-1">
              {NAV.map((section) => (
                <li key={section.id}>
                  <button
                    onClick={() => scrollTo(section.id)}
                    className="w-full text-left text-sm px-3 py-1.5 rounded-lg btn-interact font-medium"
                    style={{
                      color: "var(--foreground)",
                      opacity: activeId === section.id ? 1 : 0.55,
                      background: activeId === section.id ? "var(--card)" : "transparent",
                    }}
                  >
                    {section.label}
                  </button>
                  {section.children && (
                    <ul className="ml-3 mt-1 space-y-0.5">
                      {section.children.map((child) => (
                        <li key={child.id}>
                          <button
                            onClick={() => scrollTo(child.id)}
                            className="w-full text-left text-xs px-3 py-1.5 rounded-lg btn-interact"
                            style={{
                              color: "var(--foreground)",
                              opacity: activeId === child.id ? 1 : 0.45,
                              background: activeId === child.id ? "var(--card)" : "transparent",
                            }}
                          >
                            {child.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <main id="main-content" className="flex-1 min-w-0 px-4 lg:px-10 pb-24">
          {/* Hero */}
          <div id="getting-started" className="pt-12 pb-6 scroll-mt-20">
            <div className="flex items-center gap-2 mb-3">
              <Badge color="green">v1</Badge>
              <span className="text-xs" style={{ color: "var(--foreground)", opacity: 0.45 }}>REST API</span>
            </div>
            <h1 className="text-3xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
              Sky Style API
            </h1>
            <p className="text-sm leading-relaxed max-w-2xl" style={{ color: "var(--foreground)", opacity: 0.65 }}>
              The Sky Style API gives you programmatic access to AI-powered outfit recommendations, real-time weather data, and your closet — all in a single REST interface.
            </p>
          </div>

          {/* Base URL callout */}
          <div className="rounded-xl px-4 py-3 flex items-center gap-3 mb-2" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
            <span className="text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5, flexShrink: 0 }}>Base URL</span>
            <code className="text-sm font-mono" style={{ color: "var(--foreground)" }}>{BASE_URL}</code>
          </div>

          <p className="text-xs mt-3 mb-1" style={{ color: "var(--foreground)", opacity: 0.5 }}>
            All responses are JSON. All requests require an API key passed in the{" "}
            <code className="font-mono px-1">Authorization</code> header.
          </p>

          {/* ── Authentication ────────────────────────────────────────────── */}
          <SectionHeading id="authentication">Authentication</SectionHeading>

          <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--foreground)", opacity: 0.7 }}>
            Every request must include your API key as a Bearer token in the{" "}
            <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--card)" }}>Authorization</code>{" "}
            header. Keys are prefixed <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--card)" }}>sk_live_</code>.
          </p>

          <ol className="text-sm space-y-2 mb-6 pl-4 list-decimal" style={{ color: "var(--foreground)", opacity: 0.7 }}>
            <li>Log in to Sky Style and go to <Link href="/dashboard/api" className="underline" style={{ color: "var(--accent)" }}>Dashboard → API</Link>.</li>
            <li>Click <strong style={{ opacity: 1 }}>Create new key</strong>.</li>
            <li>Copy the key immediately — it is shown only once.</li>
            <li>Include the key in every request using the header below.</li>
          </ol>

          <div className="space-y-3">
            <CodeBlock lang="javascript" code={AUTH_JS} />
            <CodeBlock lang="curl" code={AUTH_CURL} />
          </div>

          <div
            className="rounded-xl px-4 py-3 mt-5 text-xs leading-relaxed"
            style={{ background: "rgba(255,149,0,0.08)", border: "1px solid rgba(255,149,0,0.2)", color: "var(--foreground)" }}
          >
            <span style={{ color: "#ff9500", fontWeight: 600 }}>⚠️ Keep your key secret.</span>{" "}
            <span style={{ opacity: 0.75 }}>Never expose it in client-side code or public repositories. Revoke and regenerate immediately if compromised.</span>
          </div>

          {/* ── Endpoints ─────────────────────────────────────────────────── */}
          <SectionHeading id="endpoints">Endpoints</SectionHeading>

          {/* POST /recommend */}
          <SubHeading id="endpoint-recommend" method="POST" path="/api/v1/recommend" />

          <p className="text-sm mb-4" style={{ color: "var(--foreground)", opacity: 0.7 }}>
            Returns an AI-generated outfit recommendation based on current weather at the specified coordinates.
            Optionally supply a gender context to tailor the recommendation.
          </p>

          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--foreground)", opacity: 0.4 }}>Request body</p>
          <div className="overflow-x-auto mb-5 rounded-xl" style={{ border: "1px solid var(--card-border)" }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--card)" }}>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Parameter</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Type</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Required</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Description</th>
                </tr>
              </thead>
              <tbody>
                <ParamRow name="lat" type="number" required description="Latitude (-90 to 90)" />
                <ParamRow name="lon" type="number" required description="Longitude (-180 to 180)" />
                <ParamRow name="unit" type="string" required={false} description={`Temperature unit: "metric" (°C, km/h) or "imperial" (°F, mph). Defaults to "metric".`} />
                <ParamRow name="gender" type="string" required={false} description="Gender context for the recommendation, e.g. "Male", "Female". Max 30 characters." />
              </tbody>
            </table>
          </div>

          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--foreground)", opacity: 0.4 }}>Response (200)</p>
          <div className="overflow-x-auto mb-5 rounded-xl" style={{ border: "1px solid var(--card-border)" }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--card)" }}>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Field</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Type</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Description</th>
                </tr>
              </thead>
              <tbody>
                <ResponseRow name="outfit" type="string" description="Concise outfit recommendation (up to 120 words)." />
                <ResponseRow name="reasoning" type="string" description="Explanation linking weather conditions to the outfit choices." />
                <ResponseRow name="weather" type="object" description="Key weather conditions used for the recommendation (see /weather response fields)." />
                <ResponseRow name="model" type="string" description="AI model that generated the recommendation." />
                <ResponseRow name="generated_at" type="string" description="ISO-8601 UTC timestamp of generation." />
              </tbody>
            </table>
          </div>

          <div className="space-y-3 mb-4">
            <CodeBlock lang="javascript" code={RECOMMEND_JS} />
            <CodeBlock lang="curl" code={RECOMMEND_CURL} />
          </div>

          <div className="rounded-xl px-4 py-3 text-xs mb-2" style={{ background: "var(--card)", border: "1px solid var(--card-border)", color: "var(--foreground)", opacity: 0.7 }}>
            💳 <strong>Credit cost:</strong> 2 credits per request.
          </div>

          {/* POST /recweather */}
          <SubHeading id="endpoint-recweather" method="POST" path="/api/v1/recweather" />

          <p className="text-sm mb-4" style={{ color: "var(--foreground)", opacity: 0.7 }}>
            Combined endpoint — returns an AI outfit recommendation <em>and</em> the full weather snapshot used to generate it in a single round-trip.
            Ideal when you need both pieces of data together.
          </p>

          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--foreground)", opacity: 0.4 }}>Request body</p>
          <div className="overflow-x-auto mb-5 rounded-xl" style={{ border: "1px solid var(--card-border)" }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--card)" }}>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Parameter</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Type</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Required</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Description</th>
                </tr>
              </thead>
              <tbody>
                <ParamRow name="lat" type="number" required description="Latitude (-90 to 90)" />
                <ParamRow name="lon" type="number" required description="Longitude (-180 to 180)" />
                <ParamRow name="unit" type="string" required={false} description={`"metric" (default) | "imperial"`} />
                <ParamRow name="gender" type="string" required={false} description="Gender context. Max 30 characters." />
              </tbody>
            </table>
          </div>

          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--foreground)", opacity: 0.4 }}>Response (200)</p>
          <div className="overflow-x-auto mb-5 rounded-xl" style={{ border: "1px solid var(--card-border)" }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--card)" }}>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Field</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Type</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Description</th>
                </tr>
              </thead>
              <tbody>
                <ResponseRow name="outfit" type="string" description="AI outfit recommendation." />
                <ResponseRow name="reasoning" type="string" description="Explanation of the recommendation." />
                <ResponseRow name="weather" type="object" description="Full weather snapshot (all /weather fields plus source)." />
                <ResponseRow name="model" type="string" description="AI model used." />
                <ResponseRow name="generated_at" type="string" description="ISO-8601 UTC timestamp." />
              </tbody>
            </table>
          </div>

          <div className="space-y-3 mb-4">
            <CodeBlock lang="javascript" code={RECWEATHER_JS} />
            <CodeBlock lang="curl" code={RECWEATHER_CURL} />
          </div>

          <div className="rounded-xl px-4 py-3 text-xs mb-2" style={{ background: "var(--card)", border: "1px solid var(--card-border)", color: "var(--foreground)", opacity: 0.7 }}>
            💳 <strong>Credit cost:</strong> 3 credits per request.
          </div>

          {/* GET /weather */}
          <SubHeading id="endpoint-weather" method="GET" path="/api/v1/weather" />

          <p className="text-sm mb-4" style={{ color: "var(--foreground)", opacity: 0.7 }}>
            Returns current weather conditions for the given coordinates. No AI processing is involved — raw weather data only.
          </p>

          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--foreground)", opacity: 0.4 }}>Query parameters</p>
          <div className="overflow-x-auto mb-5 rounded-xl" style={{ border: "1px solid var(--card-border)" }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--card)" }}>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Parameter</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Type</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Required</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Description</th>
                </tr>
              </thead>
              <tbody>
                <ParamRow name="lat" type="number" required description="Latitude (-90 to 90)" />
                <ParamRow name="lon" type="number" required description="Longitude (-180 to 180)" />
                <ParamRow name="unit" type="string" required={false} description={`"metric" (default) | "imperial"`} />
              </tbody>
            </table>
          </div>

          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--foreground)", opacity: 0.4 }}>Response (200)</p>
          <div className="overflow-x-auto mb-5 rounded-xl" style={{ border: "1px solid var(--card-border)" }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--card)" }}>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Field</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Type</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Description</th>
                </tr>
              </thead>
              <tbody>
                <ResponseRow name="temp" type="number" description="Temperature in selected unit." />
                <ResponseRow name="feels_like" type="number" description="Apparent (feels-like) temperature." />
                <ResponseRow name="temp_unit" type="string" description={`"°C" or "°F"`} />
                <ResponseRow name="humidity_pct" type="number" description="Relative humidity (0–100)." />
                <ResponseRow name="wind_speed" type="number" description="Wind speed in selected unit." />
                <ResponseRow name="wind_speed_unit" type="string" description={`"km/h" or "mph"`} />
                <ResponseRow name="wind_dir" type="string" description={`Cardinal wind direction, e.g. "NW"`} />
                <ResponseRow name="description" type="string" description={`Human-readable conditions, e.g. "Partly cloudy"`} />
                <ResponseRow name="rain_chance_pct" type="number" description="Precipitation probability (0–100)." />
                <ResponseRow name="uv_index" type="number" description="UV index." />
                <ResponseRow name="is_day" type="boolean" description="Whether it is currently daytime at that location." />
                <ResponseRow name="alerts" type="string[]" description="Active weather alerts (empty array if none)." />
                <ResponseRow name="source" type="string" description="Weather data provider identifier." />
                <ResponseRow name="retrieved_at" type="string" description="ISO-8601 UTC timestamp." />
              </tbody>
            </table>
          </div>

          <div className="space-y-3 mb-4">
            <CodeBlock lang="javascript" code={WEATHER_JS} />
            <CodeBlock lang="curl" code={WEATHER_CURL} />
          </div>

          <div className="rounded-xl px-4 py-3 text-xs mb-2" style={{ background: "var(--card)", border: "1px solid var(--card-border)", color: "var(--foreground)", opacity: 0.7 }}>
            💳 <strong>Credit cost:</strong> 1 credit per request.
          </div>

          {/* GET /closet */}
          <SubHeading id="endpoint-closet" method="GET" path="/api/v1/closet" />

          <p className="text-sm mb-4" style={{ color: "var(--foreground)", opacity: 0.7 }}>
            Returns the clothing items saved in the closet of the API key owner. No parameters required — the key is used to identify the user.
          </p>

          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--foreground)", opacity: 0.4 }}>Response (200)</p>
          <div className="overflow-x-auto mb-5 rounded-xl" style={{ border: "1px solid var(--card-border)" }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--card)" }}>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Field</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Type</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Description</th>
                </tr>
              </thead>
              <tbody>
                <ResponseRow name="items" type="string[]" description="Array of clothing item descriptions from the user's closet." />
                <ResponseRow name="count" type="number" description="Total number of items." />
              </tbody>
            </table>
          </div>

          <div className="space-y-3 mb-4">
            <CodeBlock lang="javascript" code={CLOSET_JS} />
            <CodeBlock lang="curl" code={CLOSET_CURL} />
          </div>

          <div className="rounded-xl px-4 py-3 text-xs mb-2" style={{ background: "var(--card)", border: "1px solid var(--card-border)", color: "var(--foreground)", opacity: 0.7 }}>
            💳 <strong>Credit cost:</strong> 1 credit per request.
          </div>

          {/* ── Error Reference ───────────────────────────────────────────── */}
          <SectionHeading id="errors">Error Reference</SectionHeading>

          <p className="text-sm mb-5" style={{ color: "var(--foreground)", opacity: 0.7 }}>
            All errors return JSON with a single <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--card)" }}>error</code> field describing the problem.
          </p>

          <div className="overflow-x-auto rounded-xl mb-4" style={{ border: "1px solid var(--card-border)" }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--card)" }}>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Status</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Error</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Meaning</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { status: "400", color: "orange" as const, code: "bad_request", meaning: "Missing or invalid request parameters." },
                  { status: "401", color: "red" as const, code: "unauthorized", meaning: "API key missing or malformed Authorization header." },
                  { status: "403", color: "red" as const, code: "forbidden / insufficient_credits", meaning: "Key is revoked or you have run out of credits." },
                  { status: "429", color: "orange" as const, code: "rate_limit_exceeded", meaning: "Too many requests per minute. Slow down and retry." },
                  { status: "500", color: "red" as const, code: "internal_error", meaning: "Unexpected server-side error." },
                  { status: "502", color: "red" as const, code: "upstream_error", meaning: "Weather provider or AI backend is unavailable. Retry after a short delay." },
                ].map((row) => (
                  <tr key={row.status} style={{ borderBottom: "1px solid var(--card-border)" }}>
                    <td className="py-3 px-4 align-top whitespace-nowrap">
                      <Badge color={row.color}>{row.status}</Badge>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <code className="text-xs font-mono" style={{ color: "var(--foreground)", opacity: 0.7 }}>{row.code}</code>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <span className="text-xs" style={{ color: "var(--foreground)", opacity: 0.7 }}>{row.meaning}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <CodeBlock lang="json" code={`{
  "error": "lat must be a number between -90 and 90, and lon between -180 and 180."
}`} />

          {/* ── Credits ───────────────────────────────────────────────────── */}
          <SectionHeading id="credits">Credits</SectionHeading>

          <p className="text-sm mb-5" style={{ color: "var(--foreground)", opacity: 0.7 }}>
            Each API key starts with <strong>100 credits</strong>. Credits are deducted after each successful request according to the cost table below.
            Check your current balance in the{" "}
            <Link href="/dashboard/api" className="underline" style={{ color: "var(--accent)" }}>API Dashboard</Link>.
          </p>

          <div className="overflow-x-auto rounded-xl mb-6" style={{ border: "1px solid var(--card-border)" }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--card)" }}>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Endpoint</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Method</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "var(--foreground)", opacity: 0.5 }}>Credit cost</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { path: "/recommend", method: "POST", cost: 2 },
                  { path: "/recweather", method: "POST", cost: 3 },
                  { path: "/weather",   method: "GET",  cost: 1 },
                  { path: "/closet",    method: "GET",  cost: 1 },
                ].map((row) => (
                  <tr key={row.path} style={{ borderBottom: "1px solid var(--card-border)" }}>
                    <td className="py-3 px-4">
                      <code className="text-xs font-mono" style={{ color: "var(--foreground)" }}>{row.path}</code>
                    </td>
                    <td className="py-3 px-4">
                      <Badge color={row.method === "GET" ? "green" : "blue"}>{row.method}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>{row.cost}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs pb-4" style={{ color: "var(--foreground)", opacity: 0.4 }}>
            Failed requests (5xx) are not charged. Requests that partially succeed (weather succeeded but AI failed) are charged at half cost.
          </p>
        </main>
      </div>
    </div>
  );
}
