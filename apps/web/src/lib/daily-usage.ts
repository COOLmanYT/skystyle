/**
 * Daily usage tracking for rate-limiting features.
 *
 * Tracks per-user daily counts for:
 * - ai_uses:      Free users get 20/day (excludes follow-ups, source picks, closet)
 * - follow_ups:   Free: 40/day, Pro: 400/day
 * - closet_uses:  Free: 4/day, Pro: unlimited
 * - source_picks: Free: 4/day, Pro: unlimited
 */

import { supabaseAdmin } from "./supabase";

export interface DailyUsageRecord {
  user_id: string;
  usage_date: string;
  ai_uses: number;
  follow_ups: number;
  closet_uses: number;
  source_picks: number;
}

const LIMITS = {
  free: { ai_uses: 20, follow_ups: 40, closet_uses: 4, source_picks: 4 },
  // demo plan: 10× the standard free limits for preview-environment testing
  demo: { ai_uses: 200, follow_ups: 400, closet_uses: 40, source_picks: 40 },
  pro: { ai_uses: Infinity, follow_ups: 400, closet_uses: Infinity, source_picks: Infinity },
  dev: { ai_uses: Infinity, follow_ups: Infinity, closet_uses: Infinity, source_picks: Infinity },
} as const;

type UsageField = "ai_uses" | "follow_ups" | "closet_uses" | "source_picks";

function today(): string {
  return new Date().toISOString().split("T")[0];
}

/** Get or create today's usage record for a user. */
export async function getDailyUsage(userId: string): Promise<DailyUsageRecord> {
  const date = today();

  const { data, error } = await supabaseAdmin
    .from("daily_usage")
    .select("*")
    .eq("user_id", userId)
    .eq("usage_date", date)
    .single();

  if (error || !data) {
    // Create today's record
    const record: DailyUsageRecord = {
      user_id: userId,
      usage_date: date,
      ai_uses: 0,
      follow_ups: 0,
      closet_uses: 0,
      source_picks: 0,
    };
    await supabaseAdmin.from("daily_usage").upsert(record, { onConflict: "user_id,usage_date" });
    return record;
  }

  return data as DailyUsageRecord;
}

/** Check if a user can use a specific feature today. */
export async function canUseFeature(
  userId: string,
  field: UsageField,
  isPro: boolean,
  isDev: boolean = false,
  isDemo: boolean = false
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const usage = await getDailyUsage(userId);
  const tier = isDev ? "dev" : isDemo ? "demo" : (isPro ? "pro" : "free");
  const limit = LIMITS[tier][field];
  const used = usage[field];
  return { allowed: used < limit, used, limit };
}

/** Increment a daily usage counter. Returns false if the limit would be exceeded. */
export async function incrementUsage(
  userId: string,
  field: UsageField,
  isPro: boolean,
  isDev: boolean = false,
  isDemo: boolean = false
): Promise<boolean> {
  const { allowed, used } = await canUseFeature(userId, field, isPro, isDev, isDemo);
  if (!allowed) return false;

  const date = today();
  await supabaseAdmin
    .from("daily_usage")
    .upsert({
      user_id: userId,
      usage_date: date,
      [field]: used + 1,
    }, { onConflict: "user_id,usage_date" });

  return true;
}

/** Get all daily limits info for a user (used in dashboard).
 *  Infinite limits are returned as `null` so they survive JSON serialisation
 *  (`JSON.stringify(Infinity)` produces `null` silently).
 */
export async function getDailyLimitsInfo(userId: string, isPro: boolean, isDev: boolean = false, isDemo: boolean = false) {
  const usage = await getDailyUsage(userId);
  const tier = isDev ? "dev" : isDemo ? "demo" : (isPro ? "pro" : "free");
  const fmt = (v: number): number | null => (v === Infinity ? null : v);
  return {
    ai: { used: usage.ai_uses, limit: fmt(LIMITS[tier].ai_uses) },
    followUps: { used: usage.follow_ups, limit: fmt(LIMITS[tier].follow_ups) },
    closet: { used: usage.closet_uses, limit: fmt(LIMITS[tier].closet_uses) },
    sourcePicks: { used: usage.source_picks, limit: fmt(LIMITS[tier].source_picks) },
  };
}
