import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { getCredits } from "@/lib/credits";
import { getDailyLimitsInfo } from "@/lib/daily-usage";
import Link from "next/link";
import PageSpacingWrapper from "@/components/PageSpacingWrapper";

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

  let isPro = false;
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
      const isDev = data?.is_dev ?? false;
      if (isPro) {
        initialCredits = await getCredits(userId);
      }
      dailyLimits = await getDailyLimitsInfo(userId, isPro, isDev);
    } catch { /* Non-fatal */ }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Navigation */}
      <nav
        className="sticky-nav px-4 py-3"
        style={{ borderBottom: "1px solid var(--card-border)" }}
      >
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm btn-interact rounded-xl px-3 py-2"
              style={{ color: "var(--foreground)", opacity: 0.6 }}
            >
              ← Dashboard
            </Link>
            <span className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              👤 Account
            </span>
          </div>
        </div>
      </nav>

      {/* Content */}
      <PageSpacingWrapper page="account" className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* User Info */}
        <div
          className="rounded-2xl p-6 space-y-3"
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
                  background: isPro ? "var(--accent)" : "var(--background)",
                  color: isPro ? "#fff" : "var(--foreground)",
                  border: isPro ? "none" : "1px solid var(--card-border)",
                }}
              >
                {isPro ? "⭐ Pro" : "Free"}
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
          {!isPro && (
            <a
              href="https://buymeacoffee.com/coolmanyt"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-xl px-4 py-2 text-xs font-medium btn-interact"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              ☕ Upgrade to Pro
            </a>
          )}
        </div>

        {/* AI Usage */}
        {dailyLimits && (
          <div
            className="rounded-2xl p-6 space-y-4"
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
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
              Plans &amp; Pricing
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--foreground)", opacity: 0.5 }}>
              Start free, upgrade when you need more.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Free */}
            <div
              className={`rounded-2xl p-6`}
              style={{
                background: "var(--card)",
                border: !isPro ? "2px solid var(--foreground)" : "1px solid var(--card-border)",
              }}
            >
              {!isPro && (
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
                <li>✅ Metric units</li>
              </ul>
            </div>

            {/* Monthly */}
            <div
              className="rounded-2xl p-6 relative"
              style={{
                background: "var(--card)",
                border: isPro ? "2px solid var(--accent)" : "1px solid var(--card-border)",
              }}
            >
              {isPro && (
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
                <li>✅ Imperial units</li>
              </ul>
              {!isPro && (
                <a
                  href="https://buymeacoffee.com/coolmanyt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 block text-center rounded-xl px-4 py-2 text-xs font-medium btn-interact"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  ☕ Upgrade to Pro
                </a>
              )}
            </div>

            {/* Lifetime */}
            <div
              className="rounded-2xl p-6"
              style={{
                background: "var(--card)",
                border: "1px solid var(--card-border)",
              }}
            >
              <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>Pro Lifetime</h3>
              <p className="text-3xl font-bold mb-1" style={{ color: "var(--foreground)" }}>
                A$30<span className="text-sm font-normal opacity-60"> once</span>
              </p>
              <ul className="text-sm space-y-2 mt-4" style={{ color: "var(--foreground)", opacity: 0.7 }}>
                <li>✅ Everything in Pro</li>
                <li>✅ One-time payment</li>
                <li>✅ Lifetime updates</li>
                <li>✅ Priority support</li>
              </ul>
              {!isPro && (
                <a
                  href="https://buymeacoffee.com/coolmanyt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 block text-center rounded-xl px-4 py-2 text-xs font-medium btn-interact"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  ☕ Get Lifetime
                </a>
              )}
            </div>

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
        <div className="flex items-center justify-center gap-4 text-xs" style={{ color: "var(--foreground)", opacity: 0.4 }}>
          <Link href="/terms" className="underline hover:opacity-70">Terms</Link>
          <Link href="/privacy" className="underline hover:opacity-70">Privacy</Link>
        </div>
      </PageSpacingWrapper>
    </div>
  );
}
