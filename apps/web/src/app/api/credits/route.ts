export const dynamic = "force-dynamic";
/**
 * GET  /api/credits       – get current credit balance
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCredits } from "@/lib/credits";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { data } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  const isPro = data?.is_pro ?? false;
  const isDev = data?.is_dev ?? false;
  if (!isPro && !isDev) {
    return NextResponse.json({ isPro: false, isDev: false, credits: null });
  }

  const credits = await getCredits(userId);
  return NextResponse.json({ isPro, isDev, credits });
}
