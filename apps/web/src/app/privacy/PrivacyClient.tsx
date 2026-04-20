"use client";

import { useState } from "react";
import SmartBackButton from "@/components/SmartBackButton";

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

export default function PrivacyClient() {
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
      <SmartBackButton fallback="/" label="← Back to Sky Style" className="text-sm mb-8 inline-block btn-interact" style={{ color: "var(--accent)" }} />

      <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
        Privacy Policy
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
            <p className="text-base font-semibold" style={{ opacity: 1 }}>👤 What we collect (and why)</p>
            <ul className="space-y-2 list-disc pl-5">
              <li><strong>Name &amp; email</strong>{" "}— from your GitHub or Google login, so you can sign in.</li>
              <li><strong>Location</strong>{" "}— only used to fetch weather. Never stored.</li>
              <li><strong>Gender preference</strong>{" "}— optional. Stored locally on your device and sent to the AI when generating recommendations.</li>
              <li><strong>Closet items</strong>{" "}— optional. Stored so AI can personalise recommendations.</li>
              <li><strong>Daily usage counts</strong>{" "}— for rate limiting only. No request content stored.</li>
            </ul>
          </div>
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
          >
            <p className="text-base font-semibold" style={{ opacity: 1 }}>🔒 Local storage</p>
            <p>Some preferences are stored locally on your device, including:</p>
            <ul className="space-y-2 list-disc pl-5">
              <li>Gender preference (optional)</li>
              <li>Bring Your Own Key — AI API key (optional, Pro/Dev only)</li>
              <li>UI preferences (theme, layout, spacing)</li>
            </ul>
            <p>This data stays on your device and is not stored on Sky Style servers. Local storage data may be cleared if you clear your browser data.</p>
          </div>
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
          >
            <p className="text-base font-semibold" style={{ opacity: 1 }}>🚫 What we never do</p>
            <ul className="space-y-2 list-disc pl-5">
              <li>We don&apos;t sell or share your data with data brokers.</li>
              <li>We don&apos;t track you across other websites.</li>
              <li>We don&apos;t store your AI API keys.</li>
              <li>We don&apos;t use advertising or tracking cookies.</li>
            </ul>
          </div>
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
          >
            <p className="text-base font-semibold" style={{ opacity: 1 }}>🔍 Transparent &amp; open source</p>
            <p>
              Everything about how we handle data is{" "}
              <a
                href="https://github.com/COOLmanYT/skystyle"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: "var(--accent)" }}
              >
                open source on GitHub
              </a>
              . You can verify every claim in this policy by reading the code.
            </p>
          </div>
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
          >
            <p className="text-base font-semibold" style={{ opacity: 1 }}>🗑️ Delete your data</p>
            <p>
              Want your data removed? Just{" "}
              <a
                href="https://github.com/COOLmanYT/skystyle/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: "var(--accent)" }}
              >
                open an issue on GitHub
              </a>{" "}
              and we&apos;ll delete everything associated with your account.
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
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Our philosophy</h2>
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
              principles. We collect only the minimum data needed for the app to work. If we
              do not need it, we do not collect it. This policy is written in plain language.
              Sky Style is a{" "}<strong>WIP/POC</strong>{" "}project — data practices may evolve as
              the project matures.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>What we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Account info</strong>{" "}— your name, email, and profile image from your
                GitHub or Google account. This is needed for authentication.
              </li>
              <li>
                <strong>Location</strong>{" "}— the coordinates you provide (GPS or typed) are sent to
                weather APIs to fetch weather data. We do not store your location history.
                Your location is{" "}<strong>not</strong>{" "}shared with the AI unless you explicitly
                consent via the &quot;Share my location with AI&quot; toggle.
              </li>
              <li>
                <strong>Gender preference</strong>{" "}— optional. Stored locally on your device and sent to the AI only when generating recommendations. This data is not stored on Sky Style servers.
              </li>
              <li>
                <strong>Closet items</strong>{" "}— clothing descriptions you choose to add. Stored so
                the AI can make personalised recommendations.
              </li>
              <li>
                <strong>Settings</strong>{" "}— your unit preference, custom prompts, and custom weather
                source URLs if you set them.
              </li>
              <li>
                <strong>Usage counts</strong>{" "}— daily counters for rate limiting (AI uses,
                follow-ups, closet uses, source picks). No request content is stored.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>What we do NOT collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>We do not track you across other websites.</li>
              <li>We do not sell or share your data with data brokers.</li>
              <li>We do not use advertising trackers or analytics cookies.</li>
              <li>We do not store your AI API keys on our servers (BYOK keys are stored locally on your device only).</li>
              <li>We do not store your location history or weather request logs.</li>
              <li>We do not store your gender preference on our servers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Local storage</h2>
            <p>Some preferences are stored locally on your device using browser local storage, including:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Gender preference (optional)</li>
              <li>Bring Your Own Key — AI API key (optional, Pro/Dev only)</li>
              <li>UI preferences (theme, layout, spacing)</li>
            </ul>
            <p className="mt-2">
              This data remains on your device and is not stored on Sky Style servers.
              Local storage data may be cleared if you clear your browser data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Third-party services</h2>
            <p>Sky Style relies on the following third-party services. Your data may be processed by them according to their own privacy policies:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <strong>
                  <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>
                    Supabase
                  </a>
                </strong>{" "}
                — database hosting. Your account and settings data is stored here.
              </li>
              <li>
                <strong>
                  <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>
                    OpenAI
                  </a>
                  {" / "}
                  <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>
                    Google Gemini
                  </a>
                </strong>{" "}
                — AI outfit recommendations. Your weather data and closet items are sent for
                each request.
              </li>
              <li>
                <strong>Weather providers:</strong>{" "}OpenWeatherMap, Open-Meteo, BOM, WeatherAPI, Visual Crossing, Pirate Weather — only coordinates are sent.
              </li>
              <li>
                <strong>
                  <a href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>
                    OpenStreetMap Nominatim
                  </a>
                </strong>{" "}
                — geocoding.
              </li>
              <li>
                <strong>
                  <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>
                    Vercel
                  </a>
                </strong>{" "}
                — hosting.
              </li>
              <li><strong>GitHub / Google OAuth</strong>{" "}— authentication providers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>International data transfers</h2>
            <p>
              Sky Style is hosted on Vercel, which operates servers globally. Your data may be
              processed in countries outside your own. By using Sky Style, you acknowledge that
              your data may be transferred internationally.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Data retention</h2>
            <p>
              Your account data and settings are kept for as long as your account exists. Daily
              usage counters are transient rate-limiting data and are not linked to specific
              requests. If you delete your account, all associated data is removed.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Security</h2>
            <p>
              We take reasonable measures to protect your data, including HTTPS, OAuth-based
              authentication, and Supabase&apos;s built-in row-level security. However, no system
              is perfectly secure. If you discover a vulnerability, please{" "}
              <a
                href="https://github.com/COOLmanYT/skystyle/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: "var(--accent)" }}
              >
                open an issue on GitHub
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Your rights</h2>
            <p>
              Regardless of where you live, we respect your data rights under the{" "}
              <em>Australian Privacy Act 1988</em>, <em>GDPR</em>, and similar laws:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Access</strong>{" "}— request a copy of all data we hold about you.</li>
              <li><strong>Correction</strong>{" "}— ask us to correct inaccurate data.</li>
              <li><strong>Deletion</strong>{" "}— request deletion of your account and all data.</li>
              <li><strong>Portability</strong>{" "}— request your data in machine-readable format.</li>
              <li><strong>Objection</strong>{" "}— object to specific processing of your data.</li>
              <li><strong>Withdraw consent</strong>{" "}— e.g. location sharing with AI, via settings.</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, open an issue on{" "}
              <a
                href="https://github.com/COOLmanYT/skystyle/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: "var(--accent)" }}
              >
                GitHub
              </a>
              . We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Cookies</h2>
            <p>
              We use a single session cookie for authentication (managed by NextAuth). We do not
              use tracking cookies, advertising cookies, or any third-party cookie services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Children</h2>
            <p>
              Sky Style is not directed at children under 13 (or under 16 in the EU). We do not
              knowingly collect data from children.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Governing law</h2>
            <p>
              This privacy policy is governed by the laws of Australia, including the{" "}
              <em>Privacy Act 1988 (Cth)</em> and the{" "}
              <em>Australian Privacy Principles (APPs)</em>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Changes</h2>
            <p>
              If we change this policy, we will update this page and the date above. Continued
              use after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Open source</h2>
            <p>
              This entire application is open source at{" "}
              <a
                href="https://github.com/COOLmanYT/skystyle"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: "var(--accent)" }}
              >
                github.com/COOLmanYT/skystyle
              </a>
              . You can verify everything stated here by reading the code.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Contact</h2>
            <p>
              Questions or data requests? Open an issue on{" "}
              <a
                href="https://github.com/COOLmanYT/skystyle/issues"
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
