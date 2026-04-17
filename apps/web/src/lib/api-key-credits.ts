const DEFAULT_INITIAL_API_KEY_CREDITS = 100;
const MIN_CHARGE = 0;

export const API_ENDPOINT_CREDIT_COSTS: Record<string, number> = {
  "/recommend": 2,
  "/recweather": 3,
  "/weather": 1,
  "/closet": 1,
};

export function getInitialApiKeyCredits(): number {
  const raw = Number.parseInt(process.env.API_KEY_INITIAL_CREDITS ?? "", 10);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return DEFAULT_INITIAL_API_KEY_CREDITS;
}

export function normalizeApiUsageEndpoint(endpoint: string): string {
  if (!endpoint) return "";
  const trimmed = endpoint.trim();
  if (trimmed.startsWith("/api/v1/")) {
    const segment = trimmed.split("/").filter(Boolean).pop() ?? "";
    // Keep legacy support for pre-rename logs/clients that still report recweath.
    // Remove after old API clients are sunset (target: SKY-4.x cleanup cycle).
    if (segment === "recweath") return "/recweather";
    return segment ? `/${segment}` : "";
  }
  // Keep legacy support for pre-rename logs/clients that still report recweath.
  // Remove after old API clients are sunset (target: SKY-4.x cleanup cycle).
  if (trimmed === "/recweath") return "/recweather";
  return trimmed;
}

export function getEndpointCreditCost(pathname: string): number {
  const normalized = normalizeApiUsageEndpoint(pathname);
  return API_ENDPOINT_CREDIT_COSTS[normalized] ?? MIN_CHARGE;
}

export function getHalfCreditCharge(cost: number): number {
  if (!Number.isFinite(cost) || cost <= 0) return MIN_CHARGE;
  return Math.max(1, Math.ceil(cost / 2));
}
