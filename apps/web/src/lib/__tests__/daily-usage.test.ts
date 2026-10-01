/**
 * Tests legacy enforcement while the approved V6 accounting rollout is off.
 * New policy/RPC behavior is covered separately by entitlement tests.
 */
import { canUseFeature, getDailyUsage, incrementUsage, LIMITS, type DailyUsageRecord } from "../daily-usage";
import { supabaseAdmin } from "../supabase";

jest.mock("../supabase", () => ({
  supabaseAdmin: { from: jest.fn() },
}));

const baseUsage: DailyUsageRecord = {
  user_id: "test-user-id",
  usage_date: "2026-09-28",
  ai_uses: 0,
  follow_ups: 0,
  closet_uses: 0,
  source_picks: 0,
  model_switches: 0,
};

const fromMock = supabaseAdmin.from as jest.Mock;
let usage: DailyUsageRecord | null;
let upsertMock: jest.Mock;

beforeEach(() => {
  usage = { ...baseUsage };
  upsertMock = jest.fn().mockResolvedValue({ error: null });
  fromMock.mockImplementation((table: string) => {
    if (table === "daily_usage") {
      const query = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockImplementation(async () => ({
          data: usage,
          error: usage ? null : { message: "not found" },
        })),
        upsert: upsertMock,
      };
      return query;
    }
    if (table === "user_access_controls") {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
});

describe("current daily limits", () => {
  it("tracks preview demo usage without touching UUID-backed account tables", async () => {
    fromMock.mockClear();
    const before = await getDailyUsage("demo-user-123");
    expect(await incrementUsage("demo-user-123", "ai_uses", false, false, true)).toBe(true);
    expect((await getDailyUsage("demo-user-123")).ai_uses).toBe(before.ai_uses + 1);
    expect(fromMock).not.toHaveBeenCalled();
  });
  it("keeps legacy Free and stable demo limits until the coordinated cutover", () => {
    expect(LIMITS.free).toEqual({
      ai_uses: 20, follow_ups: 40, closet_uses: 4, source_picks: 4, model_switches: 2,
    });
    expect(LIMITS.demo).toEqual({
      ai_uses: 200, follow_ups: 400, closet_uses: 40, source_picks: 40, model_switches: 20,
    });
  });

  it("keeps the current Pro and dev limits", () => {
    expect(LIMITS.pro).toEqual({
      ai_uses: Infinity, follow_ups: 400, closet_uses: Infinity,
      source_picks: Infinity, model_switches: Infinity,
    });
    expect(Object.values(LIMITS.dev).every((limit) => limit === Infinity)).toBe(true);
  });

  it("creates an empty usage record when none exists", async () => {
    usage = null;
    expect(await getDailyUsage("test-user-id")).toMatchObject({
      ai_uses: 0, follow_ups: 0, model_switches: 0,
    });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "test-user-id", model_switches: 0 }),
      { onConflict: "user_id,usage_date" },
    );
  });

  it.each([
    ["model_switches", 0, 2, true],
    ["model_switches", 2, 2, false],
    ["ai_uses", 10, 20, true],
    ["ai_uses", 20, 20, false],
    ["follow_ups", 20, 40, true],
    ["closet_uses", 0, 4, true],
    ["source_picks", 0, 4, true],
  ] as const)("checks Free %s at %i uses", async (field, used, limit, allowed) => {
    usage = { ...baseUsage, [field]: used };
    expect(await canUseFeature("test-user-id", field, false)).toEqual({ allowed, used, limit });
  });

  it("applies the demo multiplier to model switches", async () => {
    usage = { ...baseUsage, model_switches: 10 };
    expect(await canUseFeature("test-user-id", "model_switches", false, false, true))
      .toEqual({ allowed: true, used: 10, limit: 20 });
  });

  it.each([
    ["pro", true, false],
    ["dev", false, true],
  ] as const)("allows unlimited %s model switches", async (_tier, isPro, isDev) => {
    usage = { ...baseUsage, model_switches: 1000 };
    expect(await canUseFeature("test-user-id", "model_switches", isPro, isDev))
      .toEqual({ allowed: true, used: 1000, limit: Infinity });
  });

  it("increments an allowed counter with a conflict target", async () => {
    expect(await incrementUsage("test-user-id", "model_switches", false)).toBe(true);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ model_switches: 1, user_id: "test-user-id" }),
      { onConflict: "user_id,usage_date" },
    );
  });

  it("does not write after the limit is reached", async () => {
    usage = { ...baseUsage, model_switches: 2 };
    expect(await incrementUsage("test-user-id", "model_switches", false)).toBe(false);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("increments Pro model switches above the Free limit", async () => {
    usage = { ...baseUsage, model_switches: 100 };
    expect(await incrementUsage("test-user-id", "model_switches", true)).toBe(true);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ model_switches: 101 }),
      { onConflict: "user_id,usage_date" },
    );
  });
});
