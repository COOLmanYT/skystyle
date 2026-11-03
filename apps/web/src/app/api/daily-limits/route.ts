export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth, DEMO_USER_ID } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getDailyLimitsInfo } from "@/lib/daily-usage";
import { syncPublicUser } from "@/lib/sync-user";
import { getActiveAccounting } from "@/lib/accounting";
import { EntitlementError } from "@/lib/entitlements";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const isDemo = userId === DEMO_USER_ID;
  try {
    // The synthetic demo identity is not a persisted UUID account.
    let profile: { is_pro?: boolean; is_dev?: boolean } | null = null;
    if (!isDemo) {
      await syncPublicUser(session);
      const result = await supabaseAdmin.from("users").select("is_pro, is_dev").eq("id", userId).single();
      if (result.error) throw new Error("Unable to verify account access.");
      profile = result.data;
    }
    const account = await getActiveAccounting(userId, isDemo);
    const isPro = account ? account.plan === "pro" : profile?.is_pro ?? false;
    const isDev = account ? account.isDev : profile?.is_dev ?? false;
    const limits = await getDailyLimitsInfo(userId, isPro, isDev, isDemo);
    return NextResponse.json({ isPro, isDev, plan: account?.plan, limits }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof EntitlementError ? error.message : "Unable to verify usage." }, { status: error instanceof EntitlementError ? error.status : 503 });
  }
}
