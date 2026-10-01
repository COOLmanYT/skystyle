import { renderToStaticMarkup } from "react-dom/server";
import V6PlanOverview from "../V6PlanOverview";
import ProPeriodManager, { parseProPeriodData } from "../ProPeriodManager";
describe("approved V6 plan and admin-period copy", () => {
  it("shows all approved caps/rates and makes inactive checkout explicit", () => {
    const html = renderToStaticMarkup(<V6PlanOverview />);
    for (const text of ["A$6.99/month", "5 recommendations/day and 60/month", "25 recommendations/day and 250/month", "10 follow-ups/day and 120/month", "50 follow-ups/day and 500/month", "A$5 minimum top-up", "50 credits per A$1", "2 credits per standard recommendation", "1 credit per follow-up", "not active yet", "purchases are unavailable"]) expect(html).toContain(text);
    expect(html).not.toContain("A$4"); expect(html).not.toContain("buymeacoffee");
    expect(html).not.toContain("50 App Credits per day");
  });
  it("requires explicit dates in the admin modal, without guessed values", () => {
    const html = renderToStaticMarkup(<ProPeriodManager userId="22222222-2222-4222-8222-222222222222" onClose={() => {}} />);
    expect(html).toContain("Admin-managed Pro periods"); expect(html).toContain("Enter verified dates, not estimates");
    expect(html).toContain("value=\"\""); expect(html).toContain("Checkout and automatic renewal are disabled");
  });
  it("validates period responses before rendering or confirming an admin mutation", () => {
    const period = { id: "22222222-2222-4222-8222-222222222222", starts_at: "2026-09-29T00:00:00Z", ends_at: "2026-10-29T00:00:00Z", cancelled_at: null };
    expect(parseProPeriodData({ periods: [period], accountingEnabled: false })).toEqual({ periods: [period], accountingEnabled: false });
    for (const result of [null, {}, { periods: [], accountingEnabled: "false" }, { periods: [null], accountingEnabled: false },
      ...[{ id: "bad" }, { starts_at: "invalid" }, { ends_at: period.starts_at }, { cancelled_at: "invalid" }]
        .map((bad) => ({ periods: [{ ...period, ...bad }], accountingEnabled: false }))]) {
      expect(() => parseProPeriodData(result)).toThrow("Invalid period response.");
    }
  });
});
