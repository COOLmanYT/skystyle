import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { supabaseAdmin } from "@/lib/supabase";
import { getCredits } from "@/lib/credits";
import { getDailyLimitsInfo } from "@/lib/daily-usage";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const name = session.user.name?.split(" ")[0] ?? session.user.email ?? "there";
  const userId = session.user.id;

  let isPro = false;
  let isDev = false;
  let pendingDeletion = false;
  let initialCredits: number | null = null;
  let initialDailyLimits: {
    ai: { used: number; limit: number | null };
    followUps: { used: number; limit: number | null };
    closet: { used: number; limit: number | null };
    sourcePicks: { used: number; limit: number | null };
  } | null = null;

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
      initialDailyLimits = await getDailyLimitsInfo(userId, isPro, isDev);
    } catch {
      // Non-fatal: dashboard still works without credits info
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
        userName={name}
        isPro={isPro}
        isDev={isDev}
        initialCredits={initialCredits}
        initialDailyLimits={initialDailyLimits}
      />
    </>
  );
}

