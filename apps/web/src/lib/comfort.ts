export interface ComfortPreferences {
  temperature: "neutral" | "cold" | "warm";
  fabricDislikes: string; coverage: string; footwearRestrictions: string; dressCode: string;
}
export const DEFAULT_COMFORT: ComfortPreferences = { temperature: "neutral", fabricDislikes: "", coverage: "", footwearRestrictions: "", dressCode: "" };
/** Client validation mirrors the server's positive, at-most-24-hour window. */
export function dailyWindowError(enabled: boolean, start: string, end: string): string {
  if (!enabled) return "";
  if (!start || !end) return "Choose both the start and end of your day.";
  const duration = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(duration) || duration <= 0) return "The end must be after the start.";
  return duration > 24 * 60 * 60 * 1000 ? "Choose a time window of up to 24 hours." : "";
}
export function parseComfort(value: unknown): ComfortPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid comfort preferences.");
  const raw = value as Record<string, unknown>;
  if (!["neutral", "cold", "warm"].includes(String(raw.temperature))) throw new Error("Invalid temperature preference.");
  const result: ComfortPreferences = { ...DEFAULT_COMFORT, temperature: raw.temperature as ComfortPreferences["temperature"] };
  for (const key of ["fabricDislikes", "coverage", "footwearRestrictions", "dressCode"] as const) {
    if (typeof raw[key] !== "string" || raw[key].length > 200) throw new Error("Comfort fields must be text up to 200 characters.");
    result[key] = raw[key].replace(/[\n\r\t]+/g, " ").trim();
  }
  return result;
}
