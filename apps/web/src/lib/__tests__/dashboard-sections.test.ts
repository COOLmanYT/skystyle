import { parseDashboardSections, visibleDashboardSections } from "../dashboard-sections";
describe("Dashboard section visibility", () => {
  it.each([null, undefined, "unknown", {}, []])("defaults safely for %p", (value) => { expect(parseDashboardSections(value)).toBe("both"); });
  it.each(["style", "shop"] as const)("shows only %s when selected", (mode) => { expect(visibleDashboardSections(parseDashboardSections(mode))).toEqual([mode]); });
  it("keeps Style before Shop in both mode", () => { expect(visibleDashboardSections("both")).toEqual(["style", "shop"]); });
});
