import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { getCredits, getMoneyCreditCents } from "@/lib/credits";
import { getDailyLimitsInfo, type DailyLimitsInfo } from "@/lib/daily-usage";
import Link from "next/link";
import PageSpacingWrapper from "@/components/PageSpacingWrapper";
import V6PlanOverview from "@/components/V6PlanOverview";
import HamburgerNav from "@/components/HamburgerNav";
import SecurityClient from "@/app/settings/security/SecurityClient";
import PrivacyHubClient from "@/app/settings/privacy/PrivacyHubClient";
import { handleSignOut } from "@/app/actions";
import { getActiveAccounting, type AccountSnapshot } from "@/lib/accounting";
import AccountCreditSummary from "@/components/AccountCreditSummary";
import AccountingUsage from "@/components/AccountingUsage";

function getDevEmails(): Set<string> {
  const raw = process.env.DEV_EMAILS ?? "";
  return new Set(raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
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
  let moneyCreditCents = 0;
  let apiCredits = 0;
  let dailyLimits: DailyLimitsInfo | null = null;
  let account: AccountSnapshot | null = null;
  let accountingUnavailable = false;

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
      account = await getActiveAccounting(userId);
      if (account) { isPro = account.plan === "pro"; isDev = account.isDev; initialCredits = account.isDev ? null : account.credits.total; }
      else if (isPro) {
        initialCredits = await getCredits(userId);
      }
      if (!account) {
      moneyCreditCents = await getMoneyCreditCents(userId, isPro, isDev);
      const { data: apiKeys } = await supabaseAdmin.from("api_keys").select("credits_remaining, revoked").eq("user_id", userId);
      apiCredits = (apiKeys ?? []).filter((key) => !key.revoked).reduce((total, key) => total + Math.max(0, Number(key.credits_remaining ?? 0)), 0);
      }
      dailyLimits = await getDailyLimitsInfo(userId, isPro, isDev);
    } catch { accountingUnavailable = true; isPro = false; initialCredits = null; dailyLimits = null; }
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

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <HamburgerNav
        currentPage="account"
        userName={name}
        title="👤 Account"
        signOutAction={handleSignOut}
        isDev={canAccessDevDashboard}
      />

      {/* Content */}
      <main id="main-content">
      <PageSpacingWrapper page="account" className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {accountingUnavailable && <p role="alert">Account allowance could not be verified. No legacy balance is shown; try again later.</p>}

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
                {accountingUnavailable ? "Unverified" : isDev ? "🛠️ Dev" : isPro ? "⭐ Pro" : account?.plan === "payg" ? "PAYG" : "Free"}
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
            <Link href="/pricing" className="inline-block rounded-xl border px-4 py-2 text-xs font-medium" style={{ borderColor: "var(--card-border)", color: "var(--accent)" }}>View approved V6 plans</Link>
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
            {dailyLimits.accountingActive && <AccountingUsage limits={dailyLimits} />}
            {isPro && !dailyLimits.accountingActive && (
              <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                Pro users have higher limits. App Credits are refreshed daily.
              </p>
            )}
          </div>
        )}

        <div className="max-w-3xl mx-auto rounded-2xl p-6 space-y-4" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
          {accountingUnavailable ? <p>Credit information unavailable.</p> : account ? <AccountCreditSummary credits={account.credits} isDev={account.isDev} /> : <>
          <div><h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>Credits</h2><p className="text-xs mt-1" style={{ color: "var(--foreground)", opacity: 0.55 }}>Money credit converts to API Credit on the API Dashboard. App Credit supports in-app use and developer gifts.</p></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{[
            { label: "$ Credit (AUD)", value: isDev ? "Unlimited" : `$${(moneyCreditCents / 100).toFixed(2)}` },
            { label: "API Credit", value: isDev ? "Unlimited" : apiCredits },
            { label: "App Credit", value: isDev ? "Unlimited" : initialCredits ?? 0 },
          ].map((credit) => <div key={credit.label} className="rounded-xl p-3" style={{ background: "var(--background)" }}><p className="text-xs" style={{ color: "var(--foreground)", opacity: .5 }}>{credit.label}</p><p className="text-lg font-semibold mt-1" style={{ color: "var(--foreground)" }}>{credit.value}</p></div>)}</div>
          <div className="flex gap-3 flex-wrap"><Link href="/dashboard/api" className="text-xs underline" style={{ color: "var(--accent)" }}>Manage API Credit →</Link><a href="https://buymeacoffee.com/coolmanyt" target="_blank" rel="noreferrer" className="text-xs underline" style={{ color: "var(--accent)" }}>Support Sky Style →</a></div>
          </>}
        </div>

        <div className="max-w-3xl mx-auto rounded-2xl p-6 space-y-4" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
          <div><h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>Account tools</h2><p className="text-xs mt-1" style={{ color: "var(--foreground)", opacity: 0.55 }}>Manage the parts of Sky Style that belong to your account.</p></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{[
            ["🔔 Inbox", "Read system, support, and recommendation notices", "/inbox"],
            ["⏰ Automatic recommendations", "Review or pause saved schedules", "/automatic-recommendations"],
            ["🔐 API Dashboard", "Manage keys and inspect your API activity", "/dashboard/api"],
            ["💬 Feedback conversations", "Follow up on a support ticket", "/feedback"],
          ].map(([label, description, href]) => <Link key={href} href={href} className="rounded-xl p-3 btn-interact" style={{ background: "var(--background)", border: "1px solid var(--card-border)", color: "var(--foreground)" }}><p className="text-sm font-medium">{label}</p><p className="text-xs mt-1 opacity-55">{description}</p></Link>)}</div>
        </div>

        <section className="max-w-6xl mx-auto" aria-label="Approved V6 plans"><V6PlanOverview /></section>

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

        <div className="max-w-3xl mx-auto flex items-center justify-center gap-4 text-xs pt-2" style={{ color: "var(--foreground)", opacity: 0.4 }}>
          <Link href="/terms" className="underline hover:opacity-70">Terms</Link>
          <Link href="/privacy" className="underline hover:opacity-70">Privacy</Link>
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
