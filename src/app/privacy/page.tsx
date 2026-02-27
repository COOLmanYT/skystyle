import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Sky Style",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen px-6 py-16 max-w-2xl mx-auto" style={{ background: "var(--background)" }}>
      <Link href="/" className="text-sm mb-8 inline-block hover:opacity-70" style={{ color: "var(--accent)" }}>
        ← Back to Sky Style
      </Link>

      <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
        Privacy Policy
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--foreground)", opacity: 0.5 }}>
        Last updated: February 2026
      </p>

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
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>What we collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Account info</strong> — your name, email, and profile image from your
              GitHub or Google account. This is needed for authentication.
            </li>
            <li>
              <strong>Location</strong> — the coordinates you provide (GPS or typed) are sent to
              weather APIs to fetch weather data. We do not store your location history.
              Your location is <strong>not</strong> shared with the AI unless you explicitly
              consent via the &quot;Share my location with AI&quot; toggle.
            </li>
            <li>
              <strong>Gender preference</strong> — if you choose to set one, it is sent to the AI
              to tailor recommendations. This is entirely optional and not stored permanently.
            </li>
            <li>
              <strong>Closet items</strong> — clothing descriptions you choose to add. Stored so
              the AI can make personalised recommendations.
            </li>
            <li>
              <strong>Settings</strong> — your unit preference, custom prompts, and custom weather
              source URLs if you set them.
            </li>
            <li>
              <strong>Usage counts</strong> — daily counters for rate limiting (AI uses,
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
            <li>We do not store your AI API keys (Bring Your Own Key is single-request only).</li>
            <li>We do not store your location history or weather request logs.</li>
          </ul>
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
              each request. We use the API tier of these services, which may have different
              data handling practices than their consumer products — please refer to each
              provider&apos;s API data usage policy for details.
            </li>
            <li>
              <strong>Weather data providers:</strong>
              <ul className="list-disc pl-5 space-y-1 mt-1">
                <li>
                  <a href="https://openweathermap.org/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>
                    OpenWeatherMap
                  </a>
                </li>
                <li>
                  <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>
                    Open-Meteo
                  </a>
                </li>
                <li>
                  <a href="http://www.bom.gov.au/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>
                    Australian Bureau of Meteorology (BOM)
                  </a>
                </li>
                <li>
                  <a href="https://www.weatherapi.com/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>
                    WeatherAPI.com
                  </a>{" "}(optional)
                </li>
                <li>
                  <a href="https://www.visualcrossing.com/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>
                    Visual Crossing
                  </a>{" "}(optional)
                </li>
                <li>
                  <a href="https://pirateweather.net/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>
                    Pirate Weather
                  </a>{" "}(optional)
                </li>
              </ul>
              <p className="mt-1">
                Only your coordinates are sent to these services to retrieve weather data.
              </p>
            </li>
            <li>
              <strong>
                <a href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>
                  OpenStreetMap Nominatim
                </a>
              </strong>{" "}
              — geocoding (converting city names to coordinates).
            </li>
            <li>
              <strong>
                <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>
                  Vercel
                </a>
              </strong>{" "}
              — hosting. Vercel may collect anonymous, aggregated analytics data with no cookies.
            </li>
            <li>
              <strong>GitHub / Google OAuth</strong> — authentication providers. We only receive
              the basic profile info that you authorise.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>International data transfers</h2>
          <p>
            Sky Style is hosted on Vercel, which operates servers globally. Your data may be
            processed in countries outside your own, including the United States and other
            regions where our third-party service providers operate. By using Sky Style, you
            acknowledge that your data may be transferred internationally. We rely on the
            privacy practices of our service providers (listed above) to protect your data
            during such transfers.
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
            We take reasonable measures to protect your data, including using HTTPS for all
            connections, OAuth-based authentication (no passwords stored), and Supabase&apos;s
            built-in row-level security. However, no system is perfectly secure, and we cannot
            guarantee absolute security. If you discover a vulnerability, please{" "}
            <a
              href="https://github.com/COOLmanYT/what2wear/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "var(--accent)" }}
            >
              open an issue on GitHub
            </a>{" "}
            so we can address it.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Your rights</h2>
          <p>
            Regardless of where you live, we respect your data rights. This includes rights
            that may apply under the{" "}
            <em>Australian Privacy Act 1988</em>, the{" "}
            <em>EU General Data Protection Regulation (GDPR)</em>, and similar laws:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Access</strong> — you can request a copy of all data we hold about you.</li>
            <li><strong>Correction</strong> — you can ask us to correct inaccurate data.</li>
            <li><strong>Deletion</strong> — you can request deletion of your account and all associated data.</li>
            <li><strong>Portability</strong> — you can request your data in a machine-readable format.</li>
            <li><strong>Objection</strong> — you can object to specific processing of your data.</li>
            <li><strong>Withdraw consent</strong> — where processing is based on consent (e.g. location sharing with AI), you can withdraw at any time via your settings.</li>
          </ul>
          <p className="mt-2">
            To exercise any of these rights, open an issue on{" "}
            <a
              href="https://github.com/COOLmanYT/what2wear/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "var(--accent)" }}
            >
              GitHub
            </a>{" "}
            or contact us directly. We will respond within 30 days.
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
            knowingly collect data from children. If you believe a child has provided us with
            personal data, please contact us so we can delete it promptly.
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
            If we change this policy, we will update this page and the date above. For material
            changes, we will notify users through the dashboard. Continued use after changes
            constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Open source</h2>
          <p>
            This entire application, including how we handle data, is open source at{" "}
            <a
              href="https://github.com/COOLmanYT/what2wear"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "var(--accent)" }}
            >
              github.com/COOLmanYT/what2wear
            </a>
            . You can verify everything stated here by reading the code.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ opacity: 1 }}>Contact</h2>
          <p>
            Questions or data requests? Open an issue on{" "}
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
    </div>
  );
}
