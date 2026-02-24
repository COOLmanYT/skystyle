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
    .select("is_pro")
    .eq("id", userId)
    .single();

  const isPro = data?.is_pro ?? false;
  if (!isPro) {
    return NextResponse.json({ isPro: false, credits: null });
  }

  const credits = await getCredits(userId);
  return NextResponse.json({ isPro: true, credits });
}
