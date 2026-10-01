import { supabaseAdmin } from "../supabase";
import { EntitlementError, entitlementDatabaseError, getEntitlementRollout, getV6AccountSnapshot, reserveV6Usage, settleV6Usage, usageFingerprint, withV6Usage } from "../entitlements";
jest.mock("../supabase", () => ({ supabaseAdmin: { from: jest.fn(), rpc: jest.fn() } }));
const from = supabaseAdmin.from as jest.Mock, rpc = supabaseAdmin.rpc as jest.Mock;
const userId = "11111111-1111-4111-8111-111111111111", requestId = "22222222-2222-4222-8222-222222222222";
const request = { userId, requestId, purpose: "recommendation" as const, validatedInput: { occasion: "work" } };
const reservation = { userId, requestId, reservedCredits: 0, billingMode: "included" as const, leaseEndsAt: "2026-09-29T12:10:00Z" };
let enabled: boolean;
beforeEach(() => {
  enabled = true;
  from.mockImplementation((table:string) => {
    const result=()=>({data:table === "users" ? {is_dev:false,pending_deletion:false} : table === "user_access_controls" ? null : {enabled,checkout_enabled:false},error:null});
    return {select:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),single:jest.fn(async()=>result()),maybeSingle:jest.fn(async()=>result())};
  });
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => name === "v6_reserve_usage"
    ? { data: { requestId: args.p_request_id, status: "reserved", created: true, billingMode: "included", reservedCredits: 0, leaseEndsAt: reservation.leaseEndsAt }, error: null }
    : { data: { requestId: args.p_request_id, status: args.p_success ? "committed" : "released", credits: 0 }, error: null });
});
describe("V6 accounting server adapter", () => {
  it("does not grant or reserve while the database rollout is inactive", async () => {
    enabled = false; const work = jest.fn();
    await expect(withV6Usage(request, work)).rejects.toMatchObject({ code: "v6_not_active", status: 503 });
    expect(rpc).not.toHaveBeenCalled(); expect(work).not.toHaveBeenCalled();
  });
  it("fails closed on a missing rollout row or read error", async () => {
    from.mockReturnValue({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error: { message: "secret db error" } }) });
    await expect(getEntitlementRollout()).rejects.toMatchObject({ code: "accounting_unavailable" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("does not accept a checkout-enabled database row", async () => {
    from.mockReturnValue({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { enabled: true, checkout_enabled: true }, error: null }) });
    await expect(getEntitlementRollout()).rejects.toBeInstanceOf(EntitlementError);
  });
  it("reserves before work and settles before returning output", async () => {
    const events: string[] = [];
    rpc.mockImplementation(async (name: string) => {
      events.push(name);
      return { data: name === "v6_reserve_usage" ? { ...reservation, status: "reserved", created: true } : { requestId, status: "committed", credits: 0 }, error: null };
    });
    const result = await withV6Usage(request, async () => { events.push("provider"); return "outfit"; });
    expect(result).toBe("outfit");
    expect(events).toEqual(["v6_reserve_usage", "provider", "v6_settle_usage"]);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_user_id: userId, p_request_id: requestId, p_use_credits: false });
  });
  it.each(["reserved", "committed", "released"])("never reruns a duplicate %s request", async (status) => {
    rpc.mockResolvedValue({ data: { requestId, created: false, status }, error: null });
    const work = jest.fn(); await expect(withV6Usage(request, work)).rejects.toMatchObject({ code: "request_already_processed", status: 409 });
    expect(work).not.toHaveBeenCalled(); expect(rpc).toHaveBeenCalledTimes(1);
  });
  it.each(["daily_usage_limit", "monthly_usage_limit", "insufficient_credits", "pro_period_required"])("does not start a provider or use legacy fallback after %s", async (message) => {
    rpc.mockResolvedValue({ data: null, error: { message } }); const work = jest.fn();
    await expect(withV6Usage(request, work)).rejects.toMatchObject({ code: message }); expect(work).not.toHaveBeenCalled();
  });
  it("releases failed provider requests and preserves the provider error", async () => {
    const error = new Error("provider failed");
    await expect(withV6Usage(request, async () => { throw error; })).rejects.toBe(error);
    expect(rpc).toHaveBeenLastCalledWith("v6_settle_usage", { p_user_id: userId, p_request_id: requestId, p_success: false, p_credit_charge: 0 });
  });
  it("releases unconfigured/empty Shop responses", async () => {
    const result = await withV6Usage(request, async () => ({ status: "unconfigured", products: [] }), { shouldCharge: (value) => value.status === "ok" });
    expect(result.status).toBe("unconfigured"); expect(rpc.mock.calls[1][1].p_success).toBe(false);
  });
  it("releases the hold when an internal final-charge calculation is invalid", async () => {
    await expect(withV6Usage(request, async () => "outfit", { finalCreditCharge: () => 100 })).rejects.toMatchObject({ code: "invalid_charge" });
    expect(rpc).toHaveBeenLastCalledWith("v6_settle_usage", expect.objectContaining({ p_success: false, p_credit_charge: 0 }));
  });
  it("does not serve output after a released/expired settlement", async () => {
    rpc.mockImplementation(async (name: string) => ({ data: name === "v6_reserve_usage" ? { ...reservation, created: true, status: "reserved" } : { requestId, status: "released", credits: 0 }, error: null }));
    await expect(withV6Usage(request, async () => "must not be served")).rejects.toMatchObject({ code: "reservation_released" });
  });
  it("does not serve output when finalization is uncertain", async () => {
    rpc.mockImplementation(async (name: string) => name === "v6_reserve_usage" ? { data: { ...reservation, created: true, status: "reserved" }, error: null } : { data: null, error: { message: "connection lost" } });
    await expect(withV6Usage(request, async () => "must not be served")).rejects.toMatchObject({ code: "accounting_unavailable" });
  });
  it("rejects malformed RPC receipts", async () => {
    rpc.mockResolvedValue({ data: { created: true, requestId, status: "reserved", reservedCredits: 100, billingMode: "metered" }, error: null });
    await expect(reserveV6Usage(request)).rejects.toMatchObject({ code: "accounting_unavailable" });
  });
  it("accepts partial charges no greater than the reservation", async () => {
    const held = { ...reservation, billingMode: "metered" as const, reservedCredits: 3 };
    rpc.mockResolvedValue({ data: { requestId, status: "committed", credits: 2 }, error: null });
    expect(await settleV6Usage(held, true, 2)).toEqual({ status: "committed", credits: 2 });
    expect(rpc.mock.calls[0][1].p_credit_charge).toBe(2);
    rpc.mockClear(); await expect(settleV6Usage(held, true, 4)).rejects.toMatchObject({ code: "invalid_charge" }); expect(rpc).not.toHaveBeenCalled();
  });
  it("uses a stable keyed fingerprint without storing request text or credentials", () => {
    const a = usageFingerprint({ query: "shirt", nested: { userApiKey: "secret-one", size: "M" } });
    const b = usageFingerprint({ nested: { size: "M", userApiKey: "secret-two" }, query: "shirt" });
    expect(a).toBe(b); expect(a).toMatch(/^[a-f0-9]{64}$/); expect(a).not.toContain("shirt");
    expect(usageFingerprint({ query: "coat", nested: { size: "M" } })).not.toBe(a);
  });
  it("sends only a fingerprint and accounting metadata to the reservation RPC", async () => {
    await reserveV6Usage({ ...request, validatedInput: { query: "shirt", userApiKey: "private-key" } });
    const serialized = JSON.stringify(rpc.mock.calls[0]);
    expect(serialized).not.toContain("private-key"); expect(serialized).not.toContain("shirt");
  });
  it("rejects invalid identities and API ownership context before database access", async () => {
    await expect(reserveV6Usage({ ...request, userId: "demo" })).rejects.toMatchObject({ status: 400 });
    await expect(reserveV6Usage({ ...request, purpose: "api_weather" })).rejects.toMatchObject({ status: 400 });
    expect(from).not.toHaveBeenCalled();
  });
  it("redacts arbitrary database error content", () => {
    expect(entitlementDatabaseError({ message: "SQL includes secret-private-key" }).message).not.toContain("secret-private-key");
  });
});

describe("V6 account display snapshot", () => {
  let lots: { kind: string; remaining: number | string }[];
  let isDev: boolean;
  let usageError: { message: string } | null;
  beforeEach(() => {
    lots = [{ kind: "signup", remaining: 10 }, { kind: "pro_grant", remaining: "50" }, { kind: "purchased", remaining: 20 }, { kind: "legacy_api", remaining: 5 }];
    isDev = false; usageError = null;
    rpc.mockImplementation(async (name: string) => ({ data: name === "v6_effective_plan" ? "free" : null, error: null }));
    from.mockImplementation((table: string) => {
      const response = table === "daily_usage" ? { data: [{ usage_date: "2026-09-01", ai_uses: 3, follow_ups: 6, model_switches: 0 }, { usage_date: "2026-09-29", ai_uses: 2, follow_ups: 4, model_switches: 1 }], error: usageError }
        : table === "users" ? { data: { is_dev: isDev, pending_deletion: false }, error: null }
        : table === "user_access_controls" ? { data: { app_daily_ai_limit: 3 }, error: null }
        : { data: { enabled, checkout_enabled: false }, error: null };
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(), lte: jest.fn().mockReturnThis(), gt: jest.fn().mockReturnThis(), or: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue(response), maybeSingle: jest.fn().mockResolvedValue(response), limit: jest.fn().mockResolvedValue(response), range: jest.fn().mockImplementation(async (start: number, end: number) => ({ data: lots.slice(start, end + 1), error: null })) };
    });
  });
  it("shows daily/monthly counters, source-separated credits and admin override", async () => {
    expect(await getV6AccountSnapshot(userId, new Date("2026-09-29T00:00:00Z"))).toMatchObject({ plan: "free", checkoutEnabled: false, rules: { recommendationsDaily: 3, recommendationsMonthly: 60 }, recommendations: { daily: 2, monthly: 5 }, followups: { daily: 4, monthly: 10 }, credits: { grants: 60, purchased: 20, legacy: 5, total: 85 }, modelSwitchesToday: 1 });
  });
  it("paginates larger wallets instead of truncating credits", async () => {
    lots = Array.from({ length: 503 }, () => ({ kind: "purchased", remaining: 1 }));
    expect((await getV6AccountSnapshot(userId, new Date("2026-09-29T00:00:00Z"))).credits.total).toBe(503);
  });
  it("keeps Dev unlimited without demanding a Pro period", async () => {
    isDev = true;
    expect(await getV6AccountSnapshot(userId, new Date("2026-09-29T00:00:00Z"))).toMatchObject({ plan: "dev", rules: { recommendationsDaily: null, followupsDaily: null, apiKeyLimit: null } });
    expect(rpc).not.toHaveBeenCalledWith("v6_effective_plan", expect.anything());
  });
  it("fails closed on usage-read failures, negative credits and unsafe totals", async () => {
    usageError = { message: "read failed" };
    await expect(getV6AccountSnapshot(userId)).rejects.toMatchObject({ code: "accounting_unavailable" });
    usageError = null; lots = [{ kind: "purchased", remaining: -1 }];
    await expect(getV6AccountSnapshot(userId)).rejects.toMatchObject({ code: "accounting_unavailable" });
    lots = [{ kind: "purchased", remaining: "9007199254740992" }];
    await expect(getV6AccountSnapshot(userId)).rejects.toMatchObject({ code: "accounting_unavailable" });
  });
});
jest.unmock("@/lib/entitlements");
