import { readFileSync } from "node:fs";
import path from "node:path";
import { V6_PLAN_RULES, V6_API_COSTS, V6_CHECKOUT_AVAILABLE, formatAudCents, nextUtcMonth, utcUsageWindow } from "../entitlement-policy";
import { API_ENDPOINT_CREDIT_COSTS } from "../api-key-credits";

describe("approved V6 policy", () => {
  it("matches every seed field in the exact approved migration", () => {
    const sql = readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260928221124_v6_entitlement_foundation.sql"), "utf8");
    for (const [plan, rule] of Object.entries(V6_PLAN_RULES)) {
      const values = [rule.monthlyPriceAudCents, rule.minimumTopUpAudCents, rule.creditsPerAud,
        rule.recommendationsDaily, rule.recommendationsMonthly, rule.followupsDaily, rule.followupsMonthly,
        rule.apiKeyLimit, rule.signupCredits, rule.renewalCredits, rule.recommendationCreditCost, rule.followupCreditCost]
        .map((value) => value === null ? "NULL" : String(value));
      expect(sql).toContain(`('${plan}', ${values.join(", ")})`);
    }
    expect(sql).toContain("enabled boolean NOT NULL DEFAULT false");
    expect(sql).toContain("checkout_enabled boolean NOT NULL DEFAULT false CHECK (NOT checkout_enabled)");
    expect(V6_CHECKOUT_AVAILABLE).toBe(false);
  });
  it("preserves the previously used API endpoint costs", () => {
    expect(V6_API_COSTS).toEqual({ api_recommend: API_ENDPOINT_CREDIT_COSTS["/recommend"], api_recweather: API_ENDPOINT_CREDIT_COSTS["/recweather"], api_weather: API_ENDPOINT_CREDIT_COSTS["/weather"], api_closet: API_ENDPOINT_CREDIT_COSTS["/closet"] });
  });
  it.each([[0, "A$0"], [699, "A$6.99"], [500, "A$5"]])("formats %i AUD cents", (cents, expected) => { expect(formatAudCents(cents)).toBe(expected); });
  it.each([
    ["2027-01-31T12:30:00Z", "2027-02-28T12:30:00.000Z"],
    ["2028-01-31T12:30:00Z", "2028-02-29T12:30:00.000Z"],
    ["2026-12-31T23:59:59Z", "2027-01-31T23:59:59.000Z"],
    ["2026-09-29T00:00:00Z", "2026-10-29T00:00:00.000Z"],
  ])("clips one UTC month from %s", (start, end) => { expect(nextUtcMonth(new Date(start)).toISOString()).toBe(end); });
  it("uses UTC, not the device's Australian DST offset, at day/month boundaries", () => {
    expect(utcUsageWindow(new Date("2026-10-01T09:59:59+10:00"))).toEqual({ date: "2026-09-30", month: "2026-09-01", dailyResetAt: "2026-10-01T00:00:00.000Z", monthlyResetAt: "2026-10-01T00:00:00.000Z" });
    expect(utcUsageWindow(new Date("2026-10-01T10:00:00+10:00"))).toMatchObject({ date: "2026-10-01", month: "2026-10-01", monthlyResetAt: "2026-11-01T00:00:00.000Z" });
    expect(utcUsageWindow(new Date("2026-10-04T03:00:00+11:00"))).toMatchObject({ date: "2026-10-03", dailyResetAt: "2026-10-04T00:00:00.000Z" });
  });
});
