import type { NextRequest } from "next/server";
import { GET, POST, DELETE } from "../dev/users/[userId]/pro-periods/route";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { callEntitlementRpc, EntitlementError, getEntitlementRollout } from "@/lib/entitlements";
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock("@/lib/sync-user", () => ({ syncPublicUser: jest.fn() }));
jest.mock("@/lib/dev-auth", () => ({ getDevEmails: () => new Set(["admin@example.test"]) }));
jest.mock("@/lib/entitlements", () => ({ ...jest.requireActual("@/lib/entitlements"), callEntitlementRpc: jest.fn(), getEntitlementRollout: jest.fn() }));
const actorId = "11111111-1111-4111-8111-111111111111", userId = "22222222-2222-4222-8222-222222222222", periodId = "33333333-3333-4333-8333-333333333333";
const context = { params: Promise.resolve({ userId }) };
const dates = { periodId, startsAt: "2026-09-01T00:00:00Z", endsAt: "2026-10-01T00:00:00Z" };
const from = supabaseAdmin.from as jest.Mock, rpc = callEntitlementRpc as jest.Mock;
let actor: { is_dev: boolean; pending_deletion: boolean }, auditError: { message: string } | null;
function request(body: unknown): NextRequest { return { headers: new Headers(), text: async () => JSON.stringify(body) } as NextRequest; }
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date("2026-09-29T00:00:00Z"));
  actor = { is_dev: true, pending_deletion: false }; auditError = null;
  (auth as jest.Mock).mockResolvedValue({ user: { id: actorId, email: "admin@example.test" } });
  (getEntitlementRollout as jest.Mock).mockResolvedValue({ enabled: false, checkoutEnabled: false });
  rpc.mockResolvedValue({ periodId, created: true });
  from.mockImplementation((table: string) => ({
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(async () => ({ data: actor, error: null })),
    insert: jest.fn().mockImplementation(async () => ({ data: null, error: auditError })),
    order: jest.fn().mockResolvedValue({ data: table === "v6_pro_periods" ? [] : null, error: null }),
  }));
});
afterEach(() => jest.useRealTimers());
describe("admin-managed Pro periods", () => {
  it.each([null, { user: { id: actorId, email: "ordinary@example.test" } }, { user: { id: actorId } }])("rejects unauthorized sessions before accessing account data", async (session) => {
    (auth as jest.Mock).mockResolvedValue(session);
    expect((await GET(request(null), context)).status).toBe(403); expect(from).not.toHaveBeenCalled();
  });
  it.each([{ is_dev: false, pending_deletion: false }, { is_dev: true, pending_deletion: true }])("requires an active server-verified Dev identity", async (profile) => {
    actor = profile; expect((await POST(request(dates), context)).status).toBe(403); expect(rpc).not.toHaveBeenCalled();
  });
  it("reports staged periods without initializing accounts or activating billing", async () => {
    const result = await GET(request(null), context);
    expect(await result.json()).toEqual({ periods: [], accountingEnabled: false, checkoutEnabled: false });
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([
    null, [], {}, { ...dates, periodId: "bad" }, { ...dates, startsAt: "2026-09-01" },
    { ...dates, endsAt: "2026-10-02T00:00:00Z" },
    { ...dates, startsAt: "2026-02-30T00:00:00Z", endsAt: "2026-03-30T00:00:00Z" },
    { ...dates, startsAt: "2025-09-01T00:00:00Z", endsAt: "2025-10-01T00:00:00Z" },
  ])("rejects invalid/unverified periods %p without RPC mutation", async (body) => {
    expect((await POST(request(body), context)).status).toBe(400); expect(rpc).not.toHaveBeenCalled();
  });
  it("derives actor and account IDs from the authenticated server context", async () => {
    const response = await POST(request({ ...dates, actorId: userId, userId: actorId }), context);
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("v6_set_pro_period", { p_actor_id: actorId, p_user_id: userId, p_period_id: periodId,
      p_starts_at: "2026-09-01T00:00:00.000Z", p_ends_at: "2026-10-01T00:00:00.000Z" });
    expect(from).not.toHaveBeenCalledWith("credits"); expect(from).not.toHaveBeenCalledWith("api_keys");
  });
  it("does not attempt the mutation if the request cannot be audited", async () => {
    auditError = { message: "write failed" };
    expect((await POST(request(dates), context)).status).toBe(503); expect(rpc).not.toHaveBeenCalled();
  });
  it("preserves meaningful period conflicts", async () => {
    rpc.mockRejectedValue(new EntitlementError("period_overlap", "Period overlaps.", 409));
    const response = await POST(request(dates), context); expect(response.status).toBe(409); expect((await response.json()).code).toBe("period_overlap");
  });
  it("cancels only the recorded period for the target account", async () => {
    const response = await DELETE(request({ periodId, actorId: userId }), context);
    expect(response.status).toBe(200); expect(rpc).toHaveBeenCalledWith("v6_cancel_pro_period", { p_actor_id: actorId, p_user_id: userId, p_period_id: periodId });
  });
  it("rejects cancellation without a valid ID", async () => {
    expect((await DELETE(request({}), context)).status).toBe(400); expect(rpc).not.toHaveBeenCalled();
  });
});
