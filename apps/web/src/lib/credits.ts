/**
 * Credits system for Pro users.
 * Pro users receive 50 credits per week.
 * Each /api/style call costs 1 credit.
 */

import { supabaseAdmin } from "./supabase";

const WEEKLY_CREDITS = 50;
export const PRO_MONTHLY_MONEY_CREDIT_CENTS = 100;

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

/** Read App Credit without creating the Pro weekly allowance for a free user. */
export async function getStoredAppCredits(userId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("credits")
    .select("current_balance")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Math.max(0, Number(data?.current_balance ?? 0));
}

/** Use a gifted App Credit without initialising a weekly Pro credit balance. */
export async function deductStoredAppCredit(userId: string): Promise<boolean> {
  const balance = await getStoredAppCredits(userId);
  if (balance <= 0) return false;
  const { data, error } = await supabaseAdmin
    .from("credits")
    .update({ current_balance: balance - 1 })
    .eq("user_id", userId)
    .eq("current_balance", balance)
    .select("user_id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** Grant the private $1.00 AUD Pro allowance once per calendar month. */
export async function getMoneyCreditCents(userId: string, isPro: boolean, isDev: boolean): Promise<number> {
  if (isDev) return Number.MAX_SAFE_INTEGER;
  const month = new Date().toISOString().slice(0, 7) + "-01";
  const { data, error } = await supabaseAdmin.from("credit_wallets").select("money_credit_cents, last_pro_credit_month").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  const balance = Math.max(0, Number(data?.money_credit_cents ?? 0));
  if (isPro && data?.last_pro_credit_month !== month) {
    const nextBalance = balance + PRO_MONTHLY_MONEY_CREDIT_CENTS;
    const { error: upsertError } = await supabaseAdmin.from("credit_wallets").upsert({ user_id: userId, money_credit_cents: nextBalance, last_pro_credit_month: month, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (upsertError) throw upsertError;
    return nextBalance;
  }
  if (!data) {
    const { error: insertError } = await supabaseAdmin.from("credit_wallets").insert({ user_id: userId, money_credit_cents: 0 });
    if (insertError) throw insertError;
  }
  return balance;
}
