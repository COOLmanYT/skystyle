export type RainPeriod = "hour" | "three-hours" | "day" | "unknown";
export function measurement(value: unknown, min = -Infinity, max = Infinity): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
}
export function roundedMeasurement(value: unknown, min = -Infinity, max = Infinity): number | null {
  const result = measurement(value, min, max);
  return result === null ? null : Math.round(result);
}
export function meanMeasurements(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : null;
}
export function displayMeasurement(value: number | null | undefined, suffix = ""): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value}${suffix}` : "Unavailable";
}
