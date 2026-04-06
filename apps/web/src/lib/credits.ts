/**
 * Credits system for Pro users.
 * Pro users receive 50 credits per week.
 * Each /api/style call costs 1 credit.
 */

import { supabaseAdmin } from "./supabase";

const WEEKLY_CREDITS = 50;

export interface CreditRecord {
  user_id: string;
  current_balance: number;
  last_reset_date: string; // ISO date string
}

/** Return the current credit balance for a user, resetting weekly if needed. */
export async function getCredits(userId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("credits")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    // First-time user: initialise with full weekly credits
    await supabaseAdmin.from("credits").insert({
      user_id: userId,
      current_balance: WEEKLY_CREDITS,
      last_reset_date: new Date().toISOString().split("T")[0],
    });
    return WEEKLY_CREDITS;
  }

  const record = data as CreditRecord;
  const lastReset = new Date(record.last_reset_date);
  const now = new Date();
  const daysSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24);

  // Reset weekly (every 7 days)
  if (daysSinceReset >= 7) {
    await supabaseAdmin
      .from("credits")
      .update({
        current_balance: WEEKLY_CREDITS,
        last_reset_date: now.toISOString().split("T")[0],
      })
      .eq("user_id", userId);
    return WEEKLY_CREDITS;
  }

  return record.current_balance;
}

/** Deduct one credit. Returns false if insufficient balance. */
export async function deductCredit(userId: string): Promise<boolean> {
  const balance = await getCredits(userId);
  if (balance <= 0) return false;

  await supabaseAdmin
    .from("credits")
    .update({ current_balance: balance - 1 })
    .eq("user_id", userId);

  return true;
}
