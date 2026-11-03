import { GET } from "../daily-limits/route";
import { auth } from "@/auth";
import { syncPublicUser } from "@/lib/sync-user";
import { supabaseAdmin } from "@/lib/supabase";
import { getActiveAccounting } from "@/lib/accounting";
import { getDailyLimitsInfo } from "@/lib/daily-usage";
jest.mock("@/auth", () => ({ auth: jest.fn(), DEMO_USER_ID: "demo-user-123" }));
jest.mock("@/lib/sync-user", () => ({ syncPublicUser: jest.fn() }));
jest.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock("@/lib/accounting", () => ({ getActiveAccounting: jest.fn().mockResolvedValue(null) }));
jest.mock("@/lib/daily-usage", () => ({ getDailyLimitsInfo: jest.fn().mockResolvedValue({ ai: { used: 0, limit: 200 } }) }));
describe("Usage endpoint identity boundary", () => {
  it("requires authentication before reading usage", async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(getDailyLimitsInfo).not.toHaveBeenCalled();
  });
  it("uses demo allowances without writing a synthetic ID to UUID tables", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: "demo-user-123" } });
    expect(await (await GET()).json()).toMatchObject({ isPro: false, isDev: false, limits: { ai: { limit: 200 } } });
    expect(syncPublicUser).not.toHaveBeenCalled();
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
    expect(getActiveAccounting).toHaveBeenCalledWith("demo-user-123", true);
    expect(getDailyLimitsInfo).toHaveBeenCalledWith("demo-user-123", false, false, true);
  });
  it("returns a controlled error when a real account cannot be synchronized", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: "real-account" } });
    (syncPublicUser as jest.Mock).mockRejectedValue(new Error("unavailable"));
    expect((await GET()).status).toBe(503);
    expect(getDailyLimitsInfo).not.toHaveBeenCalled();
  });
});
