export const dynamic = "force-dynamic";
/**
 * GET  /api/credits       – get current credit balance
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCredits, getMoneyCreditCents, getStoredAppCredits } from "@/lib/credits";
import { supabaseAdmin } from "@/lib/supabase";
import { API_CREDITS_PER_AUD_DOLLAR } from "@/lib/api-key-credits";
import { syncPublicUser } from "@/lib/sync-user";
import { getActiveAccounting } from "@/lib/accounting";
import { getEntitlementRollout, EntitlementError } from "@/lib/entitlements";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncPublicUser(session);

  const userId = session.user.id;
  try {
    const account = await getActiveAccounting(userId);
    if (account) return NextResponse.json({ accountingActive:true, isPro:account.plan === "pro", isDev:account.isDev,
      accountCredits:account.credits, appCredits:account.isDev ? null : account.credits.total, apiCredits:account.isDev ? null : account.credits.total,
      moneyCreditCents:0, checkoutEnabled:false, keys:[], plan:account.plan,
      usage:{ recommendations:account.recommendations, followups:account.followups }, rules:account.rules,
      dailyResetAt:account.dailyResetAt, monthlyResetAt:account.monthlyResetAt }, { headers:{ "Cache-Control":"no-store" } });
  } catch (error) { return NextResponse.json({ error:error instanceof EntitlementError ? error.message : "Unable to verify account credits." }, { status:error instanceof EntitlementError ? error.status : 503 }); }
  const { data } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  const isPro = data?.is_pro ?? false;
  const isDev = data?.is_dev ?? false;
  const [appCredits, moneyCreditCents, keysResult] = await Promise.all([
    isPro ? getCredits(userId) : getStoredAppCredits(userId),
    getMoneyCreditCents(userId, isPro, isDev),
    supabaseAdmin.from("api_keys").select("id, key_preview, nickname, folder, credits_remaining, revoked").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);
  if (keysResult.error) return NextResponse.json({ error: "Failed to load API credits." }, { status: 500 });
  return NextResponse.json({ isPro, isDev, moneyCreditCents, appCredits, apiCredits: (keysResult.data ?? []).filter((key) => !key.revoked).reduce((total, key) => total + Math.max(0, Number(key.credits_remaining ?? 0)), 0), keys: keysResult.data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await syncPublicUser(session);
  try { if ((await getEntitlementRollout()).enabled) return NextResponse.json({ error:"Per-key allocation and money-credit conversion are disabled. API requests use your shared account wallet. Purchases are unavailable." }, { status:409 }); }
  catch { return NextResponse.json({ error:"Unable to verify accounting. No credits were changed." }, { status:503 }); }
  const body = await req.json().catch(() => null) as { keyId?: unknown; moneyCreditCents?: unknown } | null;
  const keyId = typeof body?.keyId === "string" ? body.keyId : "";
  const moneyCreditCents = typeof body?.moneyCreditCents === "number" ? body.moneyCreditCents : 0;
  if (!keyId || !Number.isInteger(moneyCreditCents) || moneyCreditCents < 100 || moneyCreditCents % 100 !== 0) return NextResponse.json({ error: "Allocate whole $1.00 AUD credits to an API key." }, { status: 400 });
  const { data: user } = await supabaseAdmin.from("users").select("is_pro, is_dev").eq("id", session.user.id).maybeSingle();
  const moneyBalance = await getMoneyCreditCents(session.user.id, user?.is_pro ?? false, user?.is_dev ?? false);
  if (!user?.is_dev && moneyBalance < moneyCreditCents) return NextResponse.json({ error: "Insufficient $ Credit." }, { status: 409 });
  const { data: key, error: keyError } = await supabaseAdmin.from("api_keys").select("credits_remaining").eq("id", keyId).eq("user_id", session.user.id).eq("revoked", false).maybeSingle();
  if (keyError || !key) return NextResponse.json({ error: "API key not found." }, { status: 404 });
  const apiCredits = (moneyCreditCents / 100) * API_CREDITS_PER_AUD_DOLLAR;
  const operations = [supabaseAdmin.from("api_keys").update({ credits_remaining: Math.max(0, Number(key.credits_remaining ?? 0)) + apiCredits }).eq("id", keyId)];
  if (!user?.is_dev) operations.push(supabaseAdmin.from("credit_wallets").update({ money_credit_cents: moneyBalance - moneyCreditCents, updated_at: new Date().toISOString() }).eq("user_id", session.user.id));
  const results = await Promise.all(operations);
  const failed = results.find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });
  return NextResponse.json({ success: true, allocatedApiCredits: apiCredits });
}
