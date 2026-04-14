import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { getCredits } from "@/lib/credits";
import { getDailyLimitsInfo } from "@/lib/daily-usage";
import Link from "next/link";
import PageSpacingWrapper from "@/components/PageSpacingWrapper";
import AccountUpgradeButton from "@/components/AccountUpgradeButton";
import HamburgerNav from "@/components/HamburgerNav";
import SecurityClient from "@/app/settings/security/SecurityClient";
import PrivacyHubClient from "@/app/settings/privacy/PrivacyHubClient";

function getDevEmails(): Set<string> {
  const raw = process.env.DEV_EMAILS ?? "";
  return new Set(raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

interface DailyLimits {
  ai: { used: number; limit: number | null };
  followUps: { used: number; limit: number | null };
  closet: { used: number; limit: number | null };
  sourcePicks: { used: number; limit: number | null };
}

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const name = session.user.name?.split(" ")[0] ?? session.user.email ?? "there";
  const email = session.user.email ?? "";
  const userId = session.user.id;
  const isDevEmail = getDevEmails().has(email.toLowerCase());

  let isPro = false;
  let isDev = false;
  let mfaEnabled = false;
  let pendingDeletion = false;
  let initialCredits: number | null = null;
  let dailyLimits: DailyLimits | null = null;

  if (userId) {
    try {
      const { data } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();
      isPro = data?.is_pro ?? false;
      isDev = data?.is_dev ?? false;
      pendingDeletion = data?.pending_deletion ?? false;
      if (isPro) {
        initialCredits = await getCredits(userId);
      }
      dailyLimits = await getDailyLimitsInfo(userId, isPro, isDev);
    } catch { /* Non-fatal */ }
    try {
      const { data: mfaRow } = await supabaseAdmin
        .from("mfa_secrets")
        .select("enabled")
        .eq("user_id", userId)
        .single();
      mfaEnabled = mfaRow?.enabled ?? false;
    } catch { /* Non-fatal */ }
  }

  const canAccessDevDashboard = isDevEmail || isDev;

  const rightContent = (
    <>
      {canAccessDevDashboard && (
        <Link href="/dev" className="text-xs btn-interact rounded-xl px-3 py-2 hidden sm:block font-medium" style={{ background: "#ff9500", color: "#fff" }}>🛠️ Dev Dashboard</Link>
      )}
      <Link href="/settings" className="text-xs btn-interact rounded-xl px-3 py-2 hidden sm:block" style={{ color: "var(--foreground)", opacity: 0.5 }}>Settings</Link>
      <Link href="/settings/security" className="text-xs btn-interact rounded-xl px-3 py-2 hidden sm:block" style={{ color: "var(--foreground)", opacity: 0.5 }}>Security</Link>
      <Link href="/settings/privacy" className="text-xs btn-interact rounded-xl px-3 py-2 hidden sm:block" style={{ color: "var(--foreground)", opacity: 0.5 }}>Privacy</Link>
    </>
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <HamburgerNav
        currentPage="account"
        userName={name}
        title="👤 Account"
        rightContent={rightContent}
      />

      {/* Content */}
      <main id="main-content">
      <PageSpacingWrapper page="account" className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* User Info */}
        <div
          className="max-w-3xl mx-auto rounded-2xl p-6 space-y-3"
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
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
                {name}
              </p>
              <p className="text-sm mt-0.5" style={{ color: "var(--foreground)", opacity: 0.55 }}>
                {email}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background: isDev ? "#ff9500" : isPro ? "var(--accent)" : "var(--background)",
                  color: isDev || isPro ? "#fff" : "var(--foreground)",
                  border: isDev || isPro ? "none" : "1px solid var(--card-border)",
                }}
              >
                {isDev ? "🛠️ Dev" : isPro ? "⭐ Pro" : "Free"}
              </span>
              {isPro && initialCredits !== null && (
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--card-border)" }}
                >
                  {initialCredits} credits
                </span>
              )}
            </div>
          </div>
          <p
            className="text-xs"
            style={{ color: "var(--foreground)", opacity: 0.4 }}
          >
            You can add a GitHub or Google account to your profile by signing in with that provider.
          </p>
          {!isPro && !isDev && (
            <AccountUpgradeButton
              className="inline-block rounded-xl px-4 py-2 text-xs font-medium btn-interact"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              ☕ Upgrade to Pro
            </AccountUpgradeButton>
          )}
        </div>

        {/* AI Usage */}
        {dailyLimits && (
          <div
            className="max-w-3xl mx-auto rounded-2xl p-6 space-y-4"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
            }}
          >
            <h2
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--foreground)", opacity: 0.4 }}
            >
              AI Usage Today
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "AI uses", used: dailyLimits.ai.used, limit: dailyLimits.ai.limit },
                { label: "Follow-ups", used: dailyLimits.followUps.used, limit: dailyLimits.followUps.limit },
                { label: "Closet uses", used: dailyLimits.closet.used, limit: dailyLimits.closet.limit },
                { label: "Source picks", used: dailyLimits.sourcePicks.used, limit: dailyLimits.sourcePicks.limit },
              ].map(({ label, used, limit }) => (
                <div
                  key={label}
                  className="rounded-xl p-3 text-center"
                  style={{ background: "var(--background)" }}
                >
                  <p
                    className="text-xs mb-1"
                    style={{ color: "var(--foreground)", opacity: 0.45 }}
                  >
                    {label}
                  </p>
                  <p
                    className="text-lg font-semibold"
                    style={{
                      color: limit !== null && used >= limit ? "#ff3b30" : "var(--foreground)",
                    }}
                  >
                    {used}/{limit === null ? "∞" : limit}
                  </p>
                </div>
              ))}
            </div>
            {isPro && (
              <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                Pro users have higher limits. Credits are refreshed weekly.
              </p>
            )}
          </div>
        )}

        {/* Pricing */}
        <div className="max-w-6xl mx-auto space-y-4 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
              Plans &amp; Pricing
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--foreground)", opacity: 0.5 }}>
              Start free, upgrade when you need more.
            </p>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 ${isDev ? "2xl:grid-cols-4" : ""}`}>
            {/* Free */}
            <div
              className={`rounded-2xl p-6`}
              style={{
                background: "var(--card)",
                border: !isPro && !isDev ? "2px solid var(--foreground)" : "1px solid var(--card-border)",
              }}
            >
              {!isPro && !isDev && (
                <span
                  className="inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-2"
                  style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--card-border)" }}
                >
                  Current plan
                </span>
              )}
              <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>Free</h3>
              <p className="text-3xl font-bold mb-4" style={{ color: "var(--foreground)" }}>A$0</p>
              <ul className="text-sm space-y-2" style={{ color: "var(--foreground)", opacity: 0.7 }}>
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
              className="rounded-2xl p-6 relative"
              style={{
                background: "var(--card)",
                border: isPro && !isDev ? "2px solid var(--accent)" : "1px solid var(--card-border)",
              }}
            >
              {isPro && !isDev && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-medium px-3 py-1 rounded-full"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  Current plan
                </span>
              )}
              <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>Pro Monthly</h3>
              <p className="text-3xl font-bold mb-1" style={{ color: "var(--foreground)" }}>
                A$4<span className="text-sm font-normal opacity-60">/month</span>
              </p>
              <ul className="text-sm space-y-2 mt-4" style={{ color: "var(--foreground)", opacity: 0.7 }}>
                <li>✅ Everything in Free</li>
                <li>✅ 50 credits per week</li>
                <li>✅ 100 follow-ups/day</li>
                <li>✅ Unlimited closet &amp; sources</li>
                <li>✅ Custom AI prompts</li>
                <li>✅ Bring your own AI key</li>
                <li>✅ Custom weather sources</li>
              </ul>
              {!isPro && !isDev && (
                <AccountUpgradeButton
                  className="mt-4 block w-full text-center rounded-xl px-4 py-2 text-xs font-medium btn-interact"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  ☕ Upgrade to Pro
                </AccountUpgradeButton>
              )}
            </div>

            {isDev && (
              <div
                className="rounded-2xl p-6 relative"
                style={{
                  background: "var(--card)",
                  border: "2px solid #ff9500",
                }}
              >
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-medium px-3 py-1 rounded-full"
                  style={{ background: "#ff9500", color: "#fff" }}
                >
                  Current plan
                </span>
                <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>Dev</h3>
                <p className="text-3xl font-bold mb-1" style={{ color: "var(--foreground)" }}>
                  Special Access
                </p>
                <ul className="text-sm space-y-2 mt-4" style={{ color: "var(--foreground)", opacity: 0.7 }}>
                  <li>✅ Invite-only developer tier</li>
                  <li>✅ No daily rate limits</li>
                  <li>✅ Raw AI output visibility</li>
                  <li>✅ Dev chat access</li>
                  <li>✅ Experimental feature access</li>
                </ul>
              </div>
            )}

            {/* Pay As You Go */}
            <div
              className="rounded-2xl p-6 relative"
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
              <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>Pay As You Go</h3>
              <p className="text-3xl font-bold mb-1" style={{ color: "var(--foreground)" }}>
                A$?<span className="text-sm font-normal opacity-60">/use</span>
              </p>
              <ul className="text-sm space-y-2 mt-4" style={{ color: "var(--foreground)", opacity: 0.7 }}>
                <li>💡 Select what you want</li>
                <li>💰 Pay only for what you use</li>
                <li>🚫 No more overpaying</li>
                <li>⚡ Priority support</li>
                <li>📸 Image Upload add-on</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer links */}
        <div className="max-w-3xl mx-auto flex items-center justify-center gap-4 text-xs" style={{ color: "var(--foreground)", opacity: 0.4 }}>
          <Link href="/terms" className="underline hover:opacity-70">Terms</Link>
          <Link href="/privacy" className="underline hover:opacity-70">Privacy</Link>
        </div>

        {/* ── Security ── */}
        <div className="max-w-3xl mx-auto space-y-2">
          <h2
            className="text-xs font-semibold uppercase tracking-widest px-1"
            style={{ color: "var(--foreground)", opacity: 0.4 }}
          >
            🛡️ Security
          </h2>
          <SecurityClient mfaEnabled={mfaEnabled} embedded />
        </div>

        {/* ── Privacy ── */}
        <div className="max-w-3xl mx-auto space-y-2">
          <h2
            className="text-xs font-semibold uppercase tracking-widest px-1"
            style={{ color: "var(--foreground)", opacity: 0.4 }}
          >
            🔐 Privacy &amp; Data
          </h2>
          <PrivacyHubClient isPendingDeletion={pendingDeletion} embedded />
        </div>

      </PageSpacingWrapper>
      </main>
    </div>
  );
}
