export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getDailyLimitsInfo } from "@/lib/daily-usage";
import { syncPublicUser } from "@/lib/sync-user";

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
    .select("is_pro")
    .eq("id", userId)
    .single();

  const isPro = profile?.is_pro ?? false;
  const limits = await getDailyLimitsInfo(userId, isPro);

  return NextResponse.json({ isPro, limits });
}
