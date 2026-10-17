export const DASHBOARD_SECTION_OPTIONS = ["both", "style", "shop"] as const;
export type DashboardSections = typeof DASHBOARD_SECTION_OPTIONS[number];
export type DashboardSection = "style" | "shop";
export function parseDashboardSections(value: unknown): DashboardSections {
  return value === "style" || value === "shop" ? value : "both";
}
export function visibleDashboardSections(mode: DashboardSections): DashboardSection[] {
  return mode === "both" ? ["style", "shop"] : [mode];
}
