import { NextRequest, NextResponse } from "next/server";
import { auth, DEMO_USER_ID } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";
import { BYOK_PROVIDERS, getDefaultModel, getModelById, isModelAvailable, type ByokProvider, type ModelID } from "@/lib/ai";
import { getActiveAccounting, accountingRequest } from "@/lib/accounting";
import { EntitlementError, withV6Usage } from "@/lib/entitlements";
import { canUseFeature, getDailyLimitsInfo, incrementUsage } from "@/lib/daily-usage";
import { deductCredit, getCredits } from "@/lib/credits";
import { parseShopInput, searchShop, ShopError } from "@/lib/shop";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const pending = new Set<string>();
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  if (pending.has(userId)) return NextResponse.json({ error: "A shopping search is already running." }, { status: 429 });
  pending.add(userId);
  try {
    if (Number(req.headers.get("content-length")) > 16_000) throw new ShopError("Request is too large.", 413);
    const text = await req.text();
    if (text.length > 16_000) throw new ShopError("Request is too large.", 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(text); } catch { throw new ShopError("Invalid JSON body."); }
    const input = parseShopInput(body);
    if (body.modelId !== undefined && (typeof body.modelId !== "string" || !getModelById(body.modelId as ModelID))) throw new ShopError("Invalid model.");
    if (body.byokProvider !== undefined && !BYOK_PROVIDERS.includes(body.byokProvider as ByokProvider)) throw new ShopError("Invalid BYOK provider.");
    if (body.userApiKey !== undefined && (typeof body.userApiKey !== "string" || body.userApiKey.length > 500 || /[\r\n]/.test(body.userApiKey))) throw new ShopError("Invalid API key.");
    const isDemo = userId === DEMO_USER_ID;
    if (!isDemo) await syncPublicUser(session);
    const accounting = await getActiveAccounting(userId, isDemo);
    const requestAccounting = accountingRequest(req.headers, body.useCredits);
    let isPro = false, isDev = false;
    if (!isDemo) {
      const [profile, access] = await Promise.all([
        supabaseAdmin.from("users").select("is_pro, is_dev").eq("id", userId).single(),
        supabaseAdmin.from("user_access_controls").select("*").eq("user_id", userId).maybeSingle(),
      ]);
      if (profile.error || access.error) throw new ShopError("Unable to verify account access.", 503);
      if (access.data?.banned_at || (access.data?.app_blocked && (!access.data.app_blocked_until || Date.parse(access.data.app_blocked_until) > Date.now()))) throw new ShopError("App access is disabled for this account.", 403);
      isPro = profile.data?.is_pro === true; isDev = profile.data?.is_dev === true;
      if (accounting) { isPro = accounting.plan === "pro"; isDev = accounting.isDev; }
    }
    if (body.userApiKey && !isPro && !isDev) throw new ShopError("BYOK requires Pro or developer access.", 403);
    if (body.modelId && !isModelAvailable(body.modelId as ModelID, isPro, isDev)) throw new ShopError("This model is unavailable for your account.", 403);
    if (!accounting && !isDev) {
      if (isPro) { if (await getCredits(userId) <= 0) throw new ShopError("Insufficient App Credits.", 402); }
      else if (!(await canUseFeature(userId, "ai_uses", isPro, isDev, isDemo)).allowed) throw new ShopError("Daily AI limit reached.", 429);
    }
    const search = () => searchShop(input, { isPro, isDev, modelId: body.modelId as ModelID | undefined,
      userApiKey: body.userApiKey as string | undefined, byokProvider: body.byokProvider as ByokProvider | undefined,
      customPrompt: (isPro || isDev) && typeof body.clientCustomPrompt === "string" ? body.clientCustomPrompt.slice(0, 1000) : undefined });
    const result = accounting ? await withV6Usage({ userId, purpose: "recommendation", ...requestAccounting,
      modelSwitch: Boolean(body.modelId && body.modelId !== getDefaultModel(isPro, isDev).id),
      validatedInput: { input, modelId: body.modelId, customPrompt: body.clientCustomPrompt } }, search,
      { shouldCharge: (value) => value.status === "ok" && value.products.length > 0 }) : await search();
    // No charge when the source is unavailable, empty, or AI validation failed.
    if (!accounting && result.status === "ok" && !isDev) {
      if (isPro) { if (!await deductCredit(userId)) throw new ShopError("App Credit balance changed; retry after checking your balance.", 402); }
      else if (!await incrementUsage(userId, "ai_uses", isPro, isDev, isDemo)) throw new ShopError("Daily AI limit changed; check your allowance before retrying.", 429);
    }
    return NextResponse.json({ ...result, dailyLimits: await getDailyLimitsInfo(userId, isPro, isDev, isDemo),
      creditsRemaining: (accounting || isPro) && !isDev ? await getCredits(userId) : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ShopError || error instanceof EntitlementError ? error.message : "Shopping search is temporarily unavailable. Check your usage before retrying." }, { status: error instanceof ShopError || error instanceof EntitlementError ? error.status : 502 });
  } finally { pending.delete(userId); }
}
