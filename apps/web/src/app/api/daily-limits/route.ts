export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
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

  // Sync NextAuth user to public.users (required for FK references in app tables)
  await syncPublicUser(session);

  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  try {
    const account = await getActiveAccounting(userId);
    const isPro = account ? account.plan === "pro" : profile?.is_pro ?? false;
    const isDev = account ? account.isDev : profile?.is_dev ?? false;
    const limits = await getDailyLimitsInfo(userId, isPro, isDev);
    return NextResponse.json({ isPro, isDev, plan: account?.plan, limits }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof EntitlementError ? error.message : "Unable to verify usage." }, { status: error instanceof EntitlementError ? error.status : 503 });
  }
}
