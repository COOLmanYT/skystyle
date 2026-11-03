import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
export const dynamic = "force-dynamic";
/** Public display metadata only. This endpoint never changes access or billing. */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.from("v6_entitlement_rollout").select("enabled").eq("singleton", true).abortSignal(AbortSignal.timeout(3000)).single();
    if (error || typeof data?.enabled !== "boolean") throw new Error();
    return NextResponse.json({ accountingEnabled: data.enabled, checkoutAvailable: false }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ accountingEnabled: null, checkoutAvailable: false, error: "Plan details are temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
