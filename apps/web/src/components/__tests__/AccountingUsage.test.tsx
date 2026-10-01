import { renderToStaticMarkup } from "react-dom/server";
import AccountingUsage from "../AccountingUsage";
import AccountCreditSummary from "../AccountCreditSummary";
import type { DailyLimitsInfo } from "@/lib/daily-usage";

describe("Shared accounting display", () => {
  it("shows daily and monthly caps independently with UTC reset dates", () => {
    const limits = { ai: {used:2,limit:5,monthlyUsed:59,monthlyLimit:60}, followUps:{used:3,limit:10,monthlyUsed:119,monthlyLimit:120}, dailyResetAt:"2026-10-02T00:00:00Z", monthlyResetAt:"2026-11-01T00:00:00Z" } as DailyLimitsInfo;
    const html=renderToStaticMarkup(<AccountingUsage limits={limits}/>);
    for (const text of ["Style + Shop + automatic", "2/5 today", "59/60 this UTC month", "3/10 today", "119/120 this UTC month", limits.dailyResetAt!, limits.monthlyResetAt!]) expect(html).toContain(text);
  });
  it("shows one shared total, not duplicate app/API balances", () => {
    const html=renderToStaticMarkup(<AccountCreditSummary credits={{total:19,grants:10,purchased:4,legacy:5}} isDev={false}/>);
    expect(html).toContain("Shared account credits: 19"); expect(html).toContain("Grants: 10 · Purchased: 4 · Imported legacy: 5");
    expect(html).toContain("not two wallets"); expect(html).toContain("purchases are unavailable");
  });
  it("does not present the developer's stored balance as a spending limit", () => {
    const html=renderToStaticMarkup(<AccountCreditSummary credits={{total:19,grants:10,purchased:4,legacy:5}} isDev/>);
    expect(html).toContain("Unlimited"); expect(html).not.toContain("Grants: 10");
  });
});
