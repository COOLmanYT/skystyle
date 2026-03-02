import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { supabaseAdmin } from "@/lib/supabase";
import { getCredits } from "@/lib/credits";
import { getDailyLimitsInfo } from "@/lib/daily-usage";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const name = session.user.name?.split(" ")[0] ?? session.user.email ?? "there";
  const email = session.user.email ?? "";
  const userId = session.user.id;

  let isPro = false;
  let isDev = false;
  let initialCredits: number | null = null;
  let initialDailyLimits: {
    ai: { used: number; limit: number };
    followUps: { used: number; limit: number };
    closet: { used: number; limit: number };
    sourcePicks: { used: number; limit: number };
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
      if (isPro) {
        initialCredits = await getCredits(userId);
      }
      initialDailyLimits = await getDailyLimitsInfo(userId, isPro, isDev);
    } catch {
      // Non-fatal: dashboard still works without credits info
    }
  }

  return (
    <Dashboard
      userName={name}
      userEmail={email}
      isPro={isPro}
      isDev={isDev}
      initialCredits={initialCredits}
      initialDailyLimits={initialDailyLimits}
    />
  );
}
