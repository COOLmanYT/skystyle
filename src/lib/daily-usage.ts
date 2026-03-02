/**
 * Daily usage tracking for rate-limiting features.
 *
 * Tracks per-user daily counts for:
 * - ai_uses:      Free users get 5/day (excludes follow-ups, source picks, closet)
 * - follow_ups:   Free: 10/day, Pro: 100/day
 * - closet_uses:  Free: 1/day, Pro: unlimited
 * - source_picks: Free: 1/day, Pro: unlimited
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
  free: { ai_uses: 5, follow_ups: 10, closet_uses: 1, source_picks: 1 },
  pro: { ai_uses: Infinity, follow_ups: 100, closet_uses: Infinity, source_picks: Infinity },
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
  isDev: boolean = false
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const usage = await getDailyUsage(userId);
  const tier = isDev ? "dev" : isPro ? "pro" : "free";
  const limit = LIMITS[tier][field];
  const used = usage[field];
  return { allowed: used < limit, used, limit };
}

/** Increment a daily usage counter. Returns false if the limit would be exceeded. */
export async function incrementUsage(
  userId: string,
  field: UsageField,
  isPro: boolean,
  isDev: boolean = false
): Promise<boolean> {
  const { allowed, used } = await canUseFeature(userId, field, isPro, isDev);
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

/** Get all daily limits info for a user (used in dashboard). */
export async function getDailyLimitsInfo(userId: string, isPro: boolean, isDev: boolean = false) {
  const usage = await getDailyUsage(userId);
  const tier = isDev ? "dev" : isPro ? "pro" : "free";
  return {
    ai: { used: usage.ai_uses, limit: LIMITS[tier].ai_uses },
    followUps: { used: usage.follow_ups, limit: LIMITS[tier].follow_ups },
    closet: { used: usage.closet_uses, limit: LIMITS[tier].closet_uses },
    sourcePicks: { used: usage.source_picks, limit: LIMITS[tier].source_picks },
  };
}
