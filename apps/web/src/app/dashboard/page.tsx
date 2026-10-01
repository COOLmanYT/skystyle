import { auth, DEMO_USER_ID } from "@/auth";
import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { supabaseAdmin } from "@/lib/supabase";
import { getCredits } from "@/lib/credits";
import { getDailyLimitsInfo, type DailyLimitsInfo } from "@/lib/daily-usage";
import Link from "next/link";
import { getOnboardingState } from "@/lib/onboarding";
import { getActiveAccounting } from "@/lib/accounting";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tour?: string; section?: string }> }) {
  const params = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const name = session.user.name?.split(" ")[0] ?? session.user.email ?? "there";
  const userId = session.user.id;

  let isPro = false;
  let isDev = false;
  let pendingDeletion = false;
  let initialCredits: number | null = null;
  let initialDailyLimits: DailyLimitsInfo | null = null;
  let initialExperienceMode: "guided" | "advanced" | null = null;
  let onboardingPersistenceAvailable = false;

  if (userId === DEMO_USER_ID) {
    initialDailyLimits = await getDailyLimitsInfo(userId, false, false, true);
  } else if (userId) {
    try {
      const { data } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();
      isPro = data?.is_pro ?? false;
      isDev = data?.is_dev ?? false;
      pendingDeletion = data?.pending_deletion ?? false;
      const account = await getActiveAccounting(userId);
      if (account) { isPro = account.plan === "pro"; isDev = account.isDev; initialCredits = account.isDev ? null : account.credits.total; }
      else if (isPro) {
        initialCredits = await getCredits(userId);
      }
      initialDailyLimits = await getDailyLimitsInfo(userId, isPro, isDev);
      const onboarding = await getOnboardingState(userId);
      onboardingPersistenceAvailable = onboarding.persistenceAvailable;
      initialExperienceMode = onboarding.experienceMode ?? (onboarding.persistenceAvailable ? "guided" : null);
    } catch {
      // Never present stale legacy Pro access when accounting cannot be verified.
      isPro = false; initialCredits = null; initialDailyLimits = null;
    }
  }

  return (
    <>
      {pendingDeletion && (
        <div
          role="alert"
          style={{
            background: "rgba(255,59,48,0.08)",
            borderBottom: "1px solid rgba(255,59,48,0.2)",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <p style={{ fontSize: 13, color: "#ff3b30", margin: 0 }}>
            ⚠️ Your account is <strong>pending deletion</strong>. A developer will review your request.
          </p>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <Link
              href="/settings/privacy"
              style={{
                fontSize: 12,
                color: "#ff3b30",
                border: "1px solid rgba(255,59,48,0.3)",
                borderRadius: 10,
                padding: "4px 12px",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Manage
            </Link>
            <Link
              href="/feedback"
              style={{
                fontSize: 12,
                color: "var(--foreground)",
                border: "1px solid var(--card-border)",
                borderRadius: 10,
                padding: "4px 12px",
                textDecoration: "none",
              }}
            >
              💬 Contact Dev
            </Link>
          </div>
        </div>
      )}
      <Dashboard
        userId={userId ?? "guest"}
        userName={name}
        isPro={isPro}
        isDev={isDev}
        initialCredits={initialCredits}
        initialDailyLimits={initialDailyLimits}
        initialExperienceMode={initialExperienceMode}
        startTour={params.tour === "1"}
        onboardingPersistenceAvailable={onboardingPersistenceAvailable}
        initialSection={params.section === "shop" ? "shop" : "style"}
      />
    </>
  );
}

