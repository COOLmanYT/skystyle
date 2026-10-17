/** Server-only adapter for the reviewed V6 transaction RPCs.
 * Routes select this path only when the database rollout is explicitly enabled.
 * Callers must authenticate and derive userId/apiKeyId on the server.
 */
import { createHmac, randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { V6_PLAN_RULES, utcUsageWindow, type EntitlementPlan, type UsagePurpose } from "./entitlement-policy";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CREDENTIAL_FIELD = /(?:api[-_]?key|authorization|password|secret|token|credential)/i;
const PURPOSES = new Set<UsagePurpose>(["recommendation", "followup", "api_recommend", "api_recweather", "api_weather", "api_closet"]);
const ERRORS: Record<string, [number, string]> = {
  v6_not_active: [503, "V6 accounting is not active yet."],
  daily_usage_limit: [429, "Daily included allowance reached. No credits were charged."],
  monthly_usage_limit: [429, "Monthly included allowance reached. No credits were charged."],
  daily_model_switch_limit: [429, "Daily model-switch allowance reached."],
  insufficient_credits: [402, "Insufficient credits for the selected credit-funded request."],
  pro_period_required: [409, "An administrator must configure your Pro subscription period."],
  account_unavailable: [403, "Account access is unavailable."],
  access_blocked: [403, "Access is disabled for this account."],
  api_key_unavailable: [401, "API key is unavailable."],
  api_key_plan_limit: [403, "This API key exceeds your plan's active-key allowance."],
  idempotency_conflict: [409, "This request ID was already used for a different request."],
  period_idempotency_conflict: [409, "This period ID was already used with different dates."],
  period_overlap: [409, "This subscription period overlaps an existing period."],
  invalid_monthly_period: [400, "Provide one explicit UTC calendar-month subscription period."],
  period_not_found: [404, "Subscription period not found."],
  admin_required: [403, "Administrator access is required."],
};

export class EntitlementError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 503) {
    super(message);
    this.name = "EntitlementError";
  }
}

export function isEntitlementUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function unavailable(): EntitlementError {
  return new EntitlementError("accounting_unavailable", "Unable to verify account accounting. No new AI request was started.");
}

/** Do not leak arbitrary database errors, statements, or credentials. */
export function entitlementDatabaseError(error: unknown): EntitlementError {
  const message = typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" ? error.message : "";
  const known = ERRORS[message];
  return known ? new EntitlementError(message, known[1], known[0]) : unavailable();
}

export async function callEntitlementRpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabaseAdmin.rpc(name, args);
  if (error) throw entitlementDatabaseError(error);
  return data;
}

export async function getEntitlementRollout(): Promise<{ enabled: boolean; checkoutEnabled: false }> {
  const { data, error } = await supabaseAdmin.from("v6_entitlement_rollout")
    .select("enabled, checkout_enabled").eq("singleton", true).single();
  if (error || !data || typeof data.enabled !== "boolean" || data.checkout_enabled !== false) throw unavailable();
  return { enabled: data.enabled, checkoutEnabled: false };
}

/** Canonicalize validated input; strip credential fields at every depth.
 * Only the keyed hash is persisted, never the input or credentials.
 */
function canonicalInput(value: unknown, ancestors = new Set<object>(), depth = 0): unknown {
  if (depth > 20) throw new EntitlementError("invalid_request", "Request is too deeply nested.", 400);
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object" || value === null || ancestors.has(value)) throw new EntitlementError("invalid_request", "Invalid request data.", 400);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) throw new EntitlementError("invalid_request", "Invalid request data.", 400);
  ancestors.add(value);
  const result = Array.isArray(value)
    ? value.map((item) => canonicalInput(item, ancestors, depth + 1))
    : Object.fromEntries(Object.entries(value).filter(([key, item]) => !CREDENTIAL_FIELD.test(key) && item !== undefined)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => [key, canonicalInput(item, ancestors, depth + 1)]));
  ancestors.delete(value);
  return result;
}

export function usageFingerprint(validatedInput: unknown): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw unavailable();
  const input = JSON.stringify(canonicalInput(validatedInput));
  if (Buffer.byteLength(input, "utf8") > 64_000) throw new EntitlementError("invalid_request", "Request is too large.", 413);
  return createHmac("sha256", secret).update("skystyle_v6_usage\0").update(input).digest("hex");
}

export interface UsageRequest {
  userId: string;
  requestId?: string;
  purpose: UsagePurpose;
  validatedInput: unknown;
  useCredits?: boolean;
  apiKeyId?: string;
  modelSwitch?: boolean;
}
export interface UsageReservation {
  userId: string;
  requestId: string;
  reservedCredits: number;
  billingMode: "included" | "metered" | "dev";
  leaseEndsAt: string;
}

export async function reserveV6Usage(input: UsageRequest): Promise<UsageReservation> {
  const rawRequestId = input.requestId ?? randomUUID();
  if (!isEntitlementUuid(input.userId) || !isEntitlementUuid(rawRequestId) || !PURPOSES.has(input.purpose)
    || (input.apiKeyId !== undefined && !isEntitlementUuid(input.apiKeyId))
    || (input.purpose.startsWith("api_") !== (input.apiKeyId !== undefined))
    || (input.useCredits !== undefined && typeof input.useCredits !== "boolean")
    || (input.modelSwitch !== undefined && typeof input.modelSwitch !== "boolean")) {
    throw new EntitlementError("invalid_request", "Invalid accounting request.", 400);
  }
  if (!(await getEntitlementRollout()).enabled) throw entitlementDatabaseError({ message: "v6_not_active" });
  const userId = input.userId.toLowerCase();
  const requestId = rawRequestId.toLowerCase();
  const apiKeyId = input.apiKeyId?.toLowerCase();
  const fingerprint = usageFingerprint({ purpose: input.purpose, apiKeyId,
    useCredits: input.useCredits ?? false, modelSwitch: input.modelSwitch ?? false, input: input.validatedInput });
  const raw = await callEntitlementRpc("v6_reserve_usage", {
    p_user_id: userId, p_request_id: requestId, p_fingerprint: fingerprint,
    p_purpose: input.purpose, p_use_credits: input.useCredits ?? false,
    p_api_key_id: apiKeyId ?? null, p_model_switch: input.modelSwitch ?? false,
  });
  if (typeof raw !== "object" || raw === null || !("created" in raw)) throw unavailable();
  if (raw.created === false) throw new EntitlementError("request_already_processed", "This request ID is already processing or settled. No new AI request was started.", 409);
  const receipt = raw as Record<string, unknown>;
  if (receipt.created !== true || receipt.requestId !== requestId || receipt.status !== "reserved"
    || !["included", "metered", "dev"].includes(String(receipt.billingMode))
    || !Number.isInteger(receipt.reservedCredits) || Number(receipt.reservedCredits) < 0 || Number(receipt.reservedCredits) > 3
    || typeof receipt.leaseEndsAt !== "string" || !Number.isFinite(Date.parse(receipt.leaseEndsAt))) throw unavailable();
  return { userId, requestId, reservedCredits: Number(receipt.reservedCredits),
    billingMode: receipt.billingMode as UsageReservation["billingMode"], leaseEndsAt: receipt.leaseEndsAt };
}

export async function settleV6Usage(receipt: UsageReservation, success: boolean, creditCharge?: number) {
  if (typeof success !== "boolean" || (creditCharge !== undefined && (!Number.isInteger(creditCharge) || creditCharge < 0 || creditCharge > receipt.reservedCredits))) {
    throw new EntitlementError("invalid_charge", "Invalid final credit charge.", 400);
  }
  const raw = await callEntitlementRpc("v6_settle_usage", { p_user_id: receipt.userId,
    p_request_id: receipt.requestId, p_success: success, p_credit_charge: creditCharge ?? null });
  const data = raw as Record<string, unknown> | null;
  if (!data || data.requestId !== receipt.requestId || !["committed", "released"].includes(String(data.status))
    || !Number.isInteger(data.credits) || Number(data.credits) < 0 || Number(data.credits) > receipt.reservedCredits) throw unavailable();
  if (success && data.status !== "committed") throw new EntitlementError("reservation_released", "The request allowance expired or access changed. The generated result cannot be delivered.", 409);
  if (!success && (data.status !== "released" || data.credits !== 0)) throw unavailable();
  return { status: data.status as "committed" | "released", credits: Number(data.credits) };
}

/** Recheck server-owned access around external provider work. A later block or
 * deletion request releases the hold instead of delivering generated output. */
async function verifyUsageAccess(input: UsageRequest, receipt: UsageReservation) {
  const [user, controls] = await Promise.all([
    supabaseAdmin.from("users").select("is_dev, pending_deletion").eq("id",receipt.userId).single(),
    supabaseAdmin.from("user_access_controls").select("banned_at, app_blocked, app_blocked_until, api_blocked, api_blocked_until").eq("user_id",receipt.userId).maybeSingle(),
  ]);
  if (user.error || controls.error || !user.data || typeof user.data.is_dev !== "boolean" || typeof user.data.pending_deletion !== "boolean") throw unavailable();
  if (user.data.pending_deletion || (receipt.billingMode === "dev" && !user.data.is_dev)) throw entitlementDatabaseError({message:"account_unavailable"});
  const control = controls.data;
  const api = input.purpose.startsWith("api_");
  const blocked = api ? control?.api_blocked : control?.app_blocked;
  const until = api ? control?.api_blocked_until : control?.app_blocked_until;
  // Invalid expiry data fails closed rather than treating a block as expired.
  if (control?.banned_at || (blocked && (!until || !Number.isFinite(Date.parse(until)) || Date.parse(until)>Date.now()))) throw entitlementDatabaseError({message:"access_blocked"});
}

/** Provider work is outside the database transaction. Await settlement before
 * serving output. Errors/empty Shop results release the hold, never silently
 * fall back to paid credits or legacy accounting. No automatic provider retry.
 */
export async function withV6Usage<T>(input: UsageRequest, work: () => Promise<T>, options: {
  shouldCharge?: (result: T) => boolean;
  finalCreditCharge?: (result: T, reserved: number) => number;
} = {}): Promise<T> {
  const receipt = await reserveV6Usage(input);
  let result: T;
  let charge: number | undefined;
  let success: boolean;
  try {
    await verifyUsageAccess(input, receipt);
    result = await work();
    await verifyUsageAccess(input, receipt);
    success = options.shouldCharge ? options.shouldCharge(result) : true;
    charge = success && options.finalCreditCharge ? options.finalCreditCharge(result, receipt.reservedCredits) : undefined;
    if (typeof success !== "boolean" || (charge !== undefined && (!Number.isInteger(charge) || charge < 0 || charge > receipt.reservedCredits))) {
      throw new EntitlementError("invalid_charge", "Invalid final credit charge.", 400);
    }
  } catch (error) {
    await settleV6Usage(receipt, false, 0);
    throw error;
  }
  await settleV6Usage(receipt, success, charge);
  return result;
}

function safeCount(value: unknown): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw unavailable();
  return number;
}

/** Account-scoped read model for later route/UI integration; errors fail closed.
 * This is a display snapshot, not authorization or a reservation.
 */
export async function getV6AccountSnapshot(userId: string, at = new Date()) {
  if (!isEntitlementUuid(userId)) throw new EntitlementError("invalid_request", "Invalid account.", 400);
  if (!Number.isFinite(at.getTime())) throw new EntitlementError("invalid_request", "Invalid accounting time.", 400);
  if (!(await getEntitlementRollout()).enabled) throw entitlementDatabaseError({ message: "v6_not_active" });
  await callEntitlementRpc("v6_initialize_account", { p_user_id: userId });
  await callEntitlementRpc("v6_release_expired_usage", { p_user_id: userId });
  const profile = await supabaseAdmin.from("users").select("is_dev, pending_deletion").eq("id", userId).single();
  if (profile.error || !profile.data || typeof profile.data.is_dev !== "boolean" || profile.data.pending_deletion !== false) throw unavailable();
  const isDev = profile.data.is_dev === true;
  const rawPlan = isDev ? "free" : await callEntitlementRpc("v6_effective_plan", { p_user_id: userId, p_at: at.toISOString() });
  if (typeof rawPlan !== "string" || !Object.hasOwn(V6_PLAN_RULES, rawPlan)) throw unavailable();
  const plan = rawPlan as EntitlementPlan;
  const window = utcUsageWindow(at);
  const [usage, access] = await Promise.all([
    supabaseAdmin.from("daily_usage").select("usage_date, ai_uses, follow_ups, model_switches")
      .eq("user_id", userId).gte("usage_date", window.month).lte("usage_date", window.date).limit(31),
    supabaseAdmin.from("user_access_controls").select("app_daily_ai_limit").eq("user_id", userId).maybeSingle(),
  ]);
  if (usage.error || access.error || !Array.isArray(usage.data)) throw unavailable();
  const today = usage.data.find((row) => row.usage_date === window.date);
  const credits = { grants: 0, purchased: 0, legacy: 0, total: 0 };
  // Paginate rather than silently truncating wallets at the Data API row cap.
  const pageSize = 500;
  for (let page = 0; page < 100; page += 1) {
    const lots = await supabaseAdmin.from("v6_credit_lots").select("kind, remaining")
      .eq("user_id", userId).eq("archived", false).gt("remaining", 0).lte("available_from", at.toISOString())
      .or(`expires_at.is.null,expires_at.gt.${at.toISOString()}`).order("id").range(page * pageSize, (page + 1) * pageSize - 1);
    if (lots.error || !Array.isArray(lots.data)) throw unavailable();
    for (const lot of lots.data) {
      if (!["signup", "pro_grant", "purchased", "legacy_api", "legacy_app"].includes(lot.kind)) throw unavailable();
      const amount = safeCount(lot.remaining);
      const field = lot.kind === "purchased" ? "purchased" : lot.kind === "signup" || lot.kind === "pro_grant" ? "grants" : "legacy";
      credits[field] = safeCount(credits[field] + amount);
      credits.total = safeCount(credits.total + amount);
    }
    if (lots.data.length < pageSize) break;
    if (page === 99) throw unavailable();
  }
  const rules = { ...V6_PLAN_RULES[plan], recommendationsDaily: V6_PLAN_RULES[plan].recommendationsDaily as number | null };
  if (typeof access.data?.app_daily_ai_limit === "number" && rules.recommendationsDaily !== null) {
    rules.recommendationsDaily = Math.min(rules.recommendationsDaily, safeCount(access.data.app_daily_ai_limit));
  }
  const effectiveRules = isDev ? { ...rules, recommendationsDaily: null, recommendationsMonthly: null, followupsDaily: null, followupsMonthly: null, apiKeyLimit: null } : rules;
  return { plan: isDev ? "dev" as const : plan, isDev, rules: effectiveRules, asOf: at.toISOString(), ...window, credits,
    recommendations: { daily: safeCount(today?.ai_uses ?? 0), monthly: usage.data.reduce((sum, row) => safeCount(sum + safeCount(row.ai_uses)), 0) },
    followups: { daily: safeCount(today?.follow_ups ?? 0), monthly: usage.data.reduce((sum, row) => safeCount(sum + safeCount(row.follow_ups)), 0) },
    modelSwitchesToday: safeCount(today?.model_switches ?? 0), checkoutEnabled: false as const };
}
