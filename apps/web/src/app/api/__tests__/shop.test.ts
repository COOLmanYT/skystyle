import { NextRequest } from "next/server";
import { POST } from "../shop/route";
import { searchShop } from "@/lib/shop";
import { incrementUsage } from "@/lib/daily-usage";
jest.mock("@/auth", () => ({ auth: jest.fn().mockResolvedValue({ user: { id: "demo" } }), DEMO_USER_ID: "demo" }));
jest.mock("@/lib/sync-user", () => ({ syncPublicUser: jest.fn() }));
jest.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock("@/lib/daily-usage", () => ({ canUseFeature: jest.fn().mockResolvedValue({ allowed: true }), incrementUsage: jest.fn().mockResolvedValue(true), getDailyLimitsInfo: jest.fn().mockResolvedValue({}) }));
jest.mock("@/lib/credits", () => ({ getCredits: jest.fn(), deductCredit: jest.fn() }));
jest.mock("@/lib/shop", () => ({ ...jest.requireActual("@/lib/shop"), searchShop: jest.fn() }));
function request(body: unknown) { return { headers: new Headers(), text: async () => JSON.stringify(body) } as NextRequest; }
describe("Shop authorization and validation", () => {
  beforeEach(() => { jest.requireMock("@/auth").auth.mockResolvedValue({ user: { id: "demo" } });
    (searchShop as jest.Mock).mockResolvedValue({ status: "unconfigured", products: [], model: null }); });
  it("requires authentication before accessing a source", async () => {
    jest.requireMock("@/auth").auth.mockResolvedValue(null); expect((await POST(request({ query: "shirt" }))).status).toBe(401); expect(searchShop).not.toHaveBeenCalled();
  });
  it.each([null, [], {}, { query: "x", region: "US" }, { query: "x", modelId: "unknown" }, { query: "x", byokProvider: "unknown" }])("rejects invalid inputs %p", async (body) => {
    expect((await POST(request(body))).status).toBe(400); expect(searchShop).not.toHaveBeenCalled();
  });
  it("rejects Pro-only BYOK for Free/Demo users", async () => {
    expect((await POST(request({ query: "shirt", byokProvider: "anthropic", userApiKey: "key" }))).status).toBe(403);
  });
  it("does not charge for unconfigured or empty product data", async () => {
    expect((await POST(request({ query: "shirt" }))).status).toBe(200); expect(incrementUsage).not.toHaveBeenCalled();
  });
  it("meters successful ranked recommendations using the current allowance", async () => {
    (searchShop as jest.Mock).mockResolvedValue({ status: "ok", products: [], model: "gemini" });
    expect((await POST(request({ query: "shirt" }))).status).toBe(200); expect(incrementUsage).toHaveBeenCalledWith("demo", "ai_uses", false, false, true);
  });
});
