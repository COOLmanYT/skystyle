import { renderToStaticMarkup } from "react-dom/server";
import PlanOverview from "../PlanOverview";
import ProPeriodManager, { parseProPeriodData } from "../ProPeriodManager";
describe("current plan and admin-period copy", () => {
  it("shows the active legacy allowances without advertising future prices", () => {
    const html = renderToStaticMarkup(<PlanOverview accountingEnabled={false} />);
    for (const text of ["20 recommendations/day", "40 follow-ups/day", "50 App Credits/day", "400 follow-ups/day", "purchases are unavailable"]) expect(html).toContain(text);
    for (const text of ["A$6.99", "Approved V6", "25 recommendations/day", "minimum top-up", "buymeacoffee"]) expect(html).not.toContain(text);
  });
  it("renders the monthly caps only when accounting is verified active", () => {
    const html = renderToStaticMarkup(<PlanOverview accountingEnabled />);
    for (const text of ["5 recommendations/day and 60/month", "25 recommendations/day and 250/month", "10 follow-ups/day and 120/month", "50 follow-ups/day and 500/month", "2 credits per standard recommendation", "1 credit per follow-up"]) expect(html).toContain(text);
    expect(html).not.toContain("50 App Credits/day");
  });
  it.each([null, undefined])("does not guess allowances when plan metadata is %s", accountingEnabled => {
    const html = renderToStaticMarkup(<PlanOverview accountingEnabled={accountingEnabled} />);
    expect(html).not.toContain("recommendations/day");
    expect(html).not.toContain("App Credits/day");
    expect(html).toContain(accountingEnabled === null ? "temporarily unavailable" : "Checking plan availability");
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
