"use client";

import { useState } from "react";
import Link from "next/link";

function SimpleToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="relative inline-flex items-center cursor-pointer focus:outline-none"
      aria-label="Simple Mode toggle"
    >
      <span
        className="block rounded-full transition-colors duration-200"
        style={{
          width: 44,
          height: 26,
          background: on ? "var(--accent)" : "var(--card-border)",
          border: "2px solid transparent",
          boxShadow: "inset 0 0 0 1px var(--card-border)",
        }}
      >
        <span
          className="block rounded-full transition-transform duration-200"
          style={{
            width: 18,
            height: 18,
            background: "#fff",
            margin: 2,
            transform: on ? "translateX(18px)" : "translateX(0)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          }}
        />
      </span>
    </button>
  );
}

export default function TermsClient() {
  const [simple, setSimple] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const saved = localStorage.getItem("skystyle_simple_mode");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  return (
    <div className="min-h-screen px-6 py-16 max-w-2xl mx-auto" style={{ background: "var(--background)" }}>
      <Link href="/" className="text-sm mb-8 inline-block hover:opacity-70" style={{ color: "var(--accent)" }}>
        ← Back to Sky Style
      </Link>

      <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
        Terms of Service
      </h1>
      <p className="text-sm mb-4" style={{ color: "var(--foreground)", opacity: 0.5 }}>
        Last updated: April 2026
      </p>

      {/* Simple Mode toggle */}
      <div
        className="flex items-center gap-3 mb-8 p-4 rounded-2xl"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
      >
        <SimpleToggle on={simple} onToggle={() => setSimple((v) => !v)} />
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            Simple Mode {simple ? "On" : "Off"}
          </p>
          <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.5 }}>
            {simple ? "Plain-English summary" : "Full legal text"}
          </p>
        </div>
      </div>

      {simple ? (
        /* ── Simple Mode ── */
        <div className="space-y-5 text-sm leading-relaxed" style={{ color: "var(--foreground)", opacity: 0.85 }}>
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
          >
            <p className="text-base font-semibold" style={{ opacity: 1 }}>🚧 This is a Work in Progress</p>
            <p>
              Sky Style is a{" "}<strong>Proof of Concept (POC)</strong>{" "}project built by one person. It may be
              buggy, break unexpectedly, or change at any time. We make no promises about reliability or uptime.
            </p>
          </div>
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
          >
            <p className="text-base font-semibold" style={{ opacity: 1 }}>☕ Donations are voluntary gifts</p>
            <p>
              If you donate via Buy Me a Coffee, that money is a voluntary gift to support server costs — it is{" "}
              <strong>not a purchase</strong>. You get no paid plan, no SLA, no guaranteed uptime, and no
              refund rights from us. The app stays free for everyone.
            </p>
          </div>
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
          >
            <p className="text-base font-semibold" style={{ opacity: 1 }}>⚠️ Zero liability</p>
            <p>
              AI outfit suggestions are just suggestions — we&apos;re not liable if you dress wrong for the weather.
              This is a fun helper, not professional advice. Use your own judgement.
            </p>
          </div>
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
          >
            <p className="text-base font-semibold" style={{ opacity: 1 }}>👤 Your data</p>
            <p>
              We store your name and email (from Google/GitHub login) so you can sign in. We track daily
              usage counts for rate-limiting. We don&apos;t sell your data or track you across the web.
            </p>
          </div>
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
          >
            <p className="text-base font-semibold" style={{ opacity: 1 }}>🔑 Bring Your Own Key</p>
            <p>
              Pro and Dev users may provide their own AI API key. This key is stored locally on your device and sent only for requests you initiate. Sky Style does not store your API key on our servers.
            </p>
          </div>
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
          >
            <p className="text-base font-semibold" style={{ opacity: 1 }}>🔓 Open source &amp; honest</p>
            <p>
              The entire codebase is{" "}
              <a
                href="https://github.com/COOLmanYT/what2wear"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: "var(--accent)" }}
              >
                open source
              </a>
              . We follow{" "}
              <a
                href="https://github.com/COOLmanYT/people-first-design"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: "var(--accent)" }}
              >
                People First Design
              </a>{" "}
              — no dark patterns, no guilt trips, no hidden fees.
            </p>
          </div>
          <p className="text-xs text-center" style={{ color: "var(--foreground)", opacity: 0.4 }}>
            Toggle off &ldquo;Simple Mode&rdquo; above to read the full legal text.
          </p>
        </div>
      ) : (
        /* ── Full Legal Text ── */
        <div className="space-y-6 text-sm leading-relaxed" style={{ color: "var(--foreground)", opacity: 0.8 }}>
          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Plain language first</h2>
            <p>
              Sky Style is built by an individual developer based in Australia — not a
              corporation. We follow{" "}
              <a
                href="https://github.com/COOLmanYT/people-first-design"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: "var(--accent)" }}
              >
                People First Design
              </a>{" "}
              principles. These terms are written in clear, everyday language. If something is
              unclear, please{" "}
              <a
                href="https://github.com/COOLmanYT/what2wear/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: "var(--accent)" }}
              >
                open an issue
              </a>{" "}
              and we will fix it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Proof of Concept status</h2>
            <p>
              Sky Style is a{" "}<strong>Work in Progress (WIP) / Proof of Concept (POC)</strong>. Features may
              change, break, or be removed at any time without notice. There are no paid Service Level
              Agreements (SLAs) or uptime guarantees of any kind. The project is operated by a single
              individual on a best-effort basis.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>What Sky Style does</h2>
            <p>
              Sky Style fetches real-time weather data from multiple sources and uses AI
              (large language models) to suggest what you might wear. It is a helpful tool —
              not a professional meteorological service, medical advice, or fashion consultancy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Your account</h2>
            <p>
              You sign in via GitHub or Google OAuth. We store your user ID, name, email, and
              profile image so you can log in again. We do not create a separate password for you.
              You are responsible for keeping your OAuth credentials secure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Free plan</h2>
            <p>
              Sky Style is free to use during its POC phase. Free accounts have daily limits
              (5 AI uses, 10 follow-ups, 1 closet use, 1 source pick per day). These limits may
              change. No paid plan is currently available.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Donations</h2>
            <p>
              Sky Style is supported by voluntary donations through{" "}
              <a
                href="https://buymeacoffee.com/coolmanyt"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: "var(--accent)" }}
              >
                Buy Me a Coffee
              </a>
              . <strong>Donations are entirely voluntary gifts, not purchases of goods or services.</strong>{" "}
              Making a donation does not entitle you to any specific feature, paid plan, uptime
              guarantee, Service Level Agreement (SLA), or level of support. Donations are
              non-refundable as they are voluntary gifts to support server and operating costs.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Bring Your Own Key</h2>
            <p>
              You may provide your own AI API key. This key is stored locally on your device and sent only for requests you initiate. Sky Style does not store your API key on our servers. You are responsible for any charges from your API provider.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>AI disclaimer</h2>
            <p>
              Outfit recommendations are generated by third-party AI models (OpenAI and/or Google
              Gemini). AI output may be inaccurate, inappropriate, or unhelpful. Sky Style does
              not guarantee the quality, safety, or suitability of any AI-generated suggestion.
              Always use your own judgement before following any recommendation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Weather data attribution</h2>
            <p>Weather data is sourced from:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><a href="https://openweathermap.org/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>OpenWeatherMap</a></li>
              <li><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>Open-Meteo</a></li>
              <li><a href="http://www.bom.gov.au/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>Australian Bureau of Meteorology (BOM)</a></li>
              <li><a href="https://www.weatherapi.com/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>WeatherAPI.com</a>{" "}(optional)</li>
              <li><a href="https://www.visualcrossing.com/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>Visual Crossing</a>{" "}(optional)</li>
              <li><a href="https://pirateweather.net/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>Pirate Weather</a>{" "}(optional)</li>
            </ul>
            <p className="mt-2">
              Data from all available sources is fetched in parallel and averaged. Neither the
              weather data nor the outfit suggestions are guaranteed to be accurate.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>&quot;As-is&quot; disclaimer</h2>
            <p>
              To the maximum extent permitted by law — including the{" "}
              <em>Australian Consumer Law (Schedule 2 of the Competition and Consumer Act 2010)</em>{" "}
              — Sky Style is provided{" "}<strong>&quot;as is&quot;</strong>{" "}and{" "}
              <strong>&quot;as available&quot;</strong>, without warranties of any kind, whether express or
              implied. This includes, but is not limited to, implied warranties of
              merchantability, fitness for a particular purpose, and non-infringement.
            </p>
            <p className="mt-2">
              Nothing in these terms excludes, restricts, or modifies any consumer guarantee
              that cannot lawfully be excluded under Australian Consumer Law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, the developer of Sky Style is not liable
              for any indirect, incidental, special, consequential, or punitive damages, or any
              loss of profits, data, or goodwill arising out of or in connection with your use
              of, or inability to use, the service.
            </p>
            <p className="mt-2">
              Sky Style is a free, donation-supported, Proof of Concept project. In any event,
              total liability for any claim relating to the service is limited to the amount you
              have actually paid to use it (which, for all users during the POC phase, is zero —
              donations are voluntary gifts and not payments for the service).
            </p>
            <p className="mt-2">
              This limitation does not apply to liability that cannot be excluded or limited
              under applicable law, including the Australian Consumer Law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Availability</h2>
            <p>
              We do our best to keep the service running, but outages happen — especially for a
              one-person, WIP/POC project. We do not guarantee any specific uptime, and are not
              liable for downtime or data loss. No paid SLA exists.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>No dark patterns</h2>
            <p>
              We do not use guilt buttons, fake urgency, confusing opt-outs, or tricks of any
              kind. If you want to stop using Sky Style, simply stop. Your data can be deleted on
              request.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Your responsibilities</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Do not abuse the service or circumvent rate limits.</li>
              <li>Do not use the service for any unlawful purpose.</li>
              <li>Keep your account credentials (OAuth tokens) secure.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Termination</h2>
            <p>
              You may stop using Sky Style at any time. We may suspend or terminate your access
              if you violate these terms or abuse the service. On termination, you may request
              deletion of your data by{" "}
              <a
                href="https://github.com/COOLmanYT/what2wear/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: "var(--accent)" }}
              >
                opening an issue on GitHub
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Governing law</h2>
            <p>
              These terms are governed by the laws of Australia. Any dispute arising from your
              use of Sky Style will be subject to the jurisdiction of the courts of Australia.
              Nothing in these terms limits any rights you may have under the Australian Consumer
              Law or any other mandatory consumer protection legislation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Changes to these terms</h2>
            <p>
              If we change these terms, we will update this page and the &quot;last updated&quot; date.
              For material changes, we will try to notify users through the dashboard. Continued
              use of the service after changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Open source</h2>
            <p>
              Sky Style is open source. You can view the full source code at{" "}
              <a
                href="https://github.com/COOLmanYT/what2wear"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: "var(--accent)" }}
              >
                github.com/COOLmanYT/what2wear
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Contact</h2>
            <p>
              Questions? Open an issue on{" "}
              <a
                href="https://github.com/COOLmanYT/what2wear/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: "var(--accent)" }}
              >
                GitHub
              </a>
              .
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
