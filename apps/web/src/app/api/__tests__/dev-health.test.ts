import { GET } from "../dev/health/route";
import { auth } from "@/auth";
import { getCategoryHealth } from "@/lib/health-checks";
import { getEntitlementRollout } from "@/lib/entitlements";
jest.mock("next/server", () => ({ NextResponse: class extends Response {
  static json(data: unknown, init: ResponseInit = {}) { return new this(JSON.stringify(data), { ...init, headers: { ...Object.fromEntries(new Headers(init.headers)), "content-type": "application/json" } }); }
} }));
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/health-checks", () => ({ ...jest.requireActual("@/lib/health-checks"), getCategoryHealth: jest.fn() }));
jest.mock("@/lib/supabase", () => ({ supabaseAdmin: {} }));
jest.mock("@/lib/entitlements", () => ({ getEntitlementRollout: jest.fn() }));
describe("Developer health diagnostics", () => {
  beforeEach(() => { process.env.DEV_EMAILS = "dev@example.test";
    (auth as jest.Mock).mockResolvedValue({ user: { email: "dev@example.test" } });
    (getCategoryHealth as jest.Mock).mockImplementation(async (category) => ({ providers: [{ provider: category, status: "ok", latencyMs: 3 }], checkedAt: "2026-10-01T00:00:00Z", cached: true }));
    (getEntitlementRollout as jest.Mock).mockResolvedValue({ enabled: false, checkoutEnabled: false });
  });
  afterAll(() => { delete process.env.DEV_EMAILS; });
  it("blocks unauthenticated and unauthorized users before probing", async () => {
    (auth as jest.Mock).mockResolvedValue(null); expect((await GET()).status).toBe(401);
    (auth as jest.Mock).mockResolvedValue({ user: { email: "other@example.test" } }); expect((await GET()).status).toBe(403);
    expect(getCategoryHealth).not.toHaveBeenCalled(); expect(getEntitlementRollout).not.toHaveBeenCalled();
  });
  it("returns shared cached probes, configuration booleans and read-only disabled rollout", async () => {
    const response = await GET(), body = await response.json();
    expect(response.headers.get("Cache-Control")).toBe("no-store"); expect(getCategoryHealth).toHaveBeenCalledTimes(3);
    expect(body).toMatchObject({ status: "ok", rollout: { status: "verified", enabled: false, checkoutEnabled: false }, services: { ai: { cached: true } } });
    expect(JSON.stringify(body)).not.toContain("test-openai-key");
  });
  it("marks unreadable rollout as unavailable without inventing disabled or active flags", async () => {
    (getEntitlementRollout as jest.Mock).mockRejectedValue(new Error("secret connection string"));
    const body = await (await GET()).json(); expect(body.rollout).toEqual({ status: "unavailable" }); expect(JSON.stringify(body)).not.toContain("secret connection string");
  });
});
