/** Read-only admin view. Visiting Dev Users must not initialize accounts or grant
 * credits. Uninitialized/missing-period accounts are labelled, not guessed. */
import { supabaseAdmin } from "./supabase";
import { EntitlementError, getEntitlementRollout, isEntitlementUuid } from "./entitlements";
import type { EntitlementPlan } from "./entitlement-policy";
import type { AccountCreditBalances } from "@/components/AccountCreditSummary";

export async function getAdminAccounting(userIds: string[]) {
  if (!(await getEntitlementRollout()).enabled) return null;
  if (userIds.length>500 || userIds.some((id)=>!isEntitlementUuid(id))) throw new EntitlementError("invalid_request","Invalid account selection.",400);
  if (!userIds.length) return new Map<string, {plan:EntitlementPlan|"uninitialized"|"period-required";credits:AccountCreditBalances}>();
  const at = new Date().toISOString();
  const summaries = new Map<string, { plan: EntitlementPlan | "uninitialized" | "period-required"; credits:AccountCreditBalances }>();
  const fail = () => new EntitlementError("accounting_unavailable", "Unable to verify account accounting.");
  const accounts = await supabaseAdmin.from("v6_account_entitlements").select("user_id, plan").in("user_id",userIds).limit(500);
  if (accounts.error || !Array.isArray(accounts.data)) throw fail();
  const initialized = new Set<string>();
  for (const row of accounts.data) {
    if (!["free","pro","payg"].includes(row.plan)) throw fail();
    initialized.add(row.user_id);
    summaries.set(row.user_id,{plan:row.plan,credits:{total:0,grants:0,purchased:0,legacy:0}});
  }
  for (const id of userIds) if (!summaries.has(id)) summaries.set(id,{plan:"uninitialized",credits:{total:0,grants:0,purchased:0,legacy:0}});
  const hasPeriod = new Set<string>(), activePeriod = new Set<string>();
  for (let page=0;page<100;page++) {
    const periods=await supabaseAdmin.from("v6_pro_periods").select("user_id, starts_at, ends_at, cancelled_at").in("user_id",userIds).order("id").range(page*500,(page+1)*500-1);
    if (periods.error || !Array.isArray(periods.data)) throw fail();
    for (const period of periods.data) {
      hasPeriod.add(period.user_id);
      if (!Number.isFinite(Date.parse(period.starts_at)) || !Number.isFinite(Date.parse(period.ends_at))) throw fail();
      if (period.cancelled_at === null && Date.parse(period.starts_at)<=Date.parse(at) && Date.parse(period.ends_at)>Date.parse(at)) activePeriod.add(period.user_id);
    }
    if (periods.data.length<500) break;
    if (page===99) throw fail();
  }
  for (const [id,summary] of summaries) if (summary.plan === "pro" && !activePeriod.has(id)) summary.plan=hasPeriod.has(id)?"free":"period-required";
  for (let page=0;page<100;page++) {
    const lots=await supabaseAdmin.from("v6_credit_lots").select("user_id, kind, remaining").in("user_id",userIds).eq("archived",false).gt("remaining",0).lte("available_from",at).or(`expires_at.is.null,expires_at.gt.${at}`).order("id").range(page*500,(page+1)*500-1);
    if (lots.error || !Array.isArray(lots.data)) throw fail();
    for (const lot of lots.data) {
      const summary=summaries.get(lot.user_id), amount=Number(lot.remaining);
      if (!summary || !initialized.has(lot.user_id) || !Number.isSafeInteger(amount) || amount<0 || !["signup","pro_grant","purchased","legacy_api","legacy_app"].includes(lot.kind)) throw fail();
      const field=lot.kind === "purchased"?"purchased":lot.kind === "signup" || lot.kind === "pro_grant"?"grants":"legacy";
      summary.credits[field]+=amount; summary.credits.total+=amount;
      if (!Number.isSafeInteger(summary.credits[field]) || !Number.isSafeInteger(summary.credits.total)) throw fail();
    }
    if (lots.data.length<500) break;
    if (page===99) throw fail();
  }
  return summaries;
}
