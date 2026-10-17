export const dynamic = "force-dynamic";
/**
 * POST /api/followup
 *
 * Body: { message: string; previousOutfit: string; previousReasoning: string;
 *         weather: WeatherData; userApiKey?: string }
 *
 * Sends a follow-up prompt to modify AI recommendations.
 * Free: 10/day, Pro: 100/day.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth, DEMO_USER_ID } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getFollowUpRecommendation, ModelID, getDefaultModel, getModelById, isModelAvailable, BYOK_PROVIDERS, type ByokProvider } from "@/lib/ai";
import { canUseFeature, incrementUsage, getDailyLimitsInfo } from "@/lib/daily-usage";
import { syncPublicUser } from "@/lib/sync-user";
import { matchEventForecast, parseRecommendationContext } from "@/lib/recommendation-context";
import type { WeatherData } from "@/lib/weather";
import { getActiveAccounting, accountingRequest } from "@/lib/accounting";
import { EntitlementError, withV6Usage } from "@/lib/entitlements";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const isDemo = userId === DEMO_USER_ID || (session.user as unknown as Record<string, unknown>).plan === "demo";

  // Sync NextAuth user to public.users (required for FK references in app tables)
  if (!isDemo) await syncPublicUser(session);

  let body: {
    message?: string;
    previousOutfit?: string;
    previousReasoning?: string;
    weather?: Record<string, unknown>;
    userApiKey?: string;
    byokProvider?: string;
    modelId?: string;
    recommendationContext?: unknown;
    useCredits?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { message, previousOutfit, previousReasoning, weather, userApiKey, modelId } = body;
  if (body.byokProvider !== undefined && !BYOK_PROVIDERS.includes(body.byokProvider as ByokProvider)) return NextResponse.json({ error: "Invalid BYOK provider" }, { status: 400 });
  if (userApiKey !== undefined && (typeof userApiKey !== "string" || userApiKey.length > 500 || /[\r\n]/.test(userApiKey))) return NextResponse.json({ error: "Invalid user API key" }, { status: 400 });
  
  // Validate modelId if provided
  if (modelId && !getModelById(modelId as ModelID)) {
    return NextResponse.json({ error: "Invalid model ID" }, { status: 400 });
  }

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (!previousOutfit || !weather) {
    return NextResponse.json({ error: "previousOutfit and weather are required" }, { status: 400 });
  }

  const parsedContext = parseRecommendationContext(body.recommendationContext);
  if (!parsedContext.ok) {
    return NextResponse.json({ error: parsedContext.error }, { status: 400 });
  }
  const recommendationContext = parsedContext.value;
  let accounting;
  let requestAccounting;
  try { accounting = await getActiveAccounting(userId, isDemo); requestAccounting = accountingRequest(req.headers, body.useCredits); }
  catch (error) { return NextResponse.json({ error: error instanceof EntitlementError ? error.message : "Unable to verify accounting." }, { status: error instanceof EntitlementError ? error.status : 503 }); }
  const typedWeather = weather as unknown as WeatherData;
  const eventForecast = matchEventForecast(typedWeather.hourly, recommendationContext?.event?.at);

  // Check Pro/Dev status
  let isPro = false;
  let isDev = false;
  if (!isDemo) {
    const [profileResult, accessControlResult] = await Promise.all([
      supabaseAdmin.from("users").select("*").eq("id", userId).single(),
      supabaseAdmin.from("user_access_controls").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    if (accessControlResult.error) return NextResponse.json({ error: "Unable to load account access controls." }, { status: 500 });
    if (accessControlResult.data?.banned_at || (accessControlResult.data?.app_blocked && (!accessControlResult.data?.app_blocked_until || Date.parse(accessControlResult.data.app_blocked_until) > Date.now()))) return NextResponse.json({ error: "App access has been disabled for this account." }, { status: 403 });
    isPro = profileResult.data?.is_pro ?? false;
    isDev = profileResult.data?.is_dev ?? false;
    if (accounting) { isPro = accounting.plan === "pro"; isDev = accounting.isDev; }
  }

  // Check daily follow-up limit (devs bypass)
  if (!accounting && !isDev) {
    const { allowed, used, limit } = await canUseFeature(userId, "follow_ups", isPro, isDev, isDemo);
    if (!allowed) {
      return NextResponse.json(
        { error: `Daily follow-up limit reached (${used}/${limit}). ${isPro ? "Try again tomorrow." : "Upgrade to Pro for 100 follow-ups per day."}` },
        { status: 429 }
      );
    }
  }

  // Load settings
  const settings = isDemo ? null : (await supabaseAdmin
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .single()).data;

  const unitPreference = settings?.unit_preference === "imperial" ? "imperial" as const : "metric" as const;
  if (accounting && ((modelId && !isModelAvailable(modelId as ModelID, isPro, isDev)) || (userApiKey && !isPro && !isDev))) return NextResponse.json({ error:"The selected model or BYOK is unavailable for your current account plan." }, { status:403 });
  const customSystemPrompt = (isPro || isDev) ? settings?.custom_system_prompt : undefined;

  let recommendation;
  try {
    // Check if user is trying to use a model switch (different from default)
    const isModelSwitch = Boolean(modelId && modelId !== getDefaultModel(isPro, isDev).id);
    
    // For free users, check model switch limit (2/week)
    if (!accounting && !isPro && !isDev && isModelSwitch) {
      const { allowed, used, limit } = await canUseFeature(userId, "model_switches", isPro, isDev, isDemo);
      if (!allowed) {
        return NextResponse.json(
          { error: `Model switch limit reached (${used}/${limit}). Upgrade to Pro for unlimited model switching.` },
          { status: 429 }
        );
      }
      // Deduct model switch
      await incrementUsage(userId, "model_switches", isPro, isDev, isDemo);
    }
    
    const generate = () => getFollowUpRecommendation({
      previousOutfit: String(previousOutfit),
      previousReasoning: String(previousReasoning ?? ""),
      weather: typedWeather,
      followUpMessage: message.trim(),
      unitPreference,
      customSystemPrompt,
      userApiKey: (isPro || isDev) ? userApiKey : undefined,
      byokProvider: (body.byokProvider ?? "openai") as ByokProvider,
      isDev,
      recommendationContext,
      eventForecast,
      modelId: accounting ? (modelId as ModelID | undefined) ?? getDefaultModel(isPro, isDev).id : modelId as ModelID | undefined,
    });
    recommendation = accounting ? await withV6Usage({ userId, purpose: "followup", ...requestAccounting,
      modelSwitch: isModelSwitch, validatedInput: { message: message.trim(), previousOutfit, previousReasoning, weather, modelId, recommendationContext } }, generate) : await generate();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: msg }, { status: err instanceof EntitlementError ? err.status : 502 });
  }

  // Increment follow-up usage (devs bypass)
  if (!accounting && !isDev) {
    await incrementUsage(userId, "follow_ups", isPro, isDev, isDemo);
  }

  const dailyLimits = await getDailyLimitsInfo(userId, isPro, isDev, isDemo);

  return NextResponse.json({
    recommendation,
    meta: {
      isPro,
      isDev,
      dailyLimits,
      recommendationContext,
      eventForecastStatus: eventForecast.status,
    },
  });
}
