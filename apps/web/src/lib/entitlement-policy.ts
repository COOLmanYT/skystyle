/** Approved V6 policy. These values are not a rollout/checkout switch. */
export const V6_PLAN_RULES = {
  free: {
    monthlyPriceAudCents: 0, minimumTopUpAudCents: null, creditsPerAud: 50,
    recommendationsDaily: 5, recommendationsMonthly: 60,
    followupsDaily: 10, followupsMonthly: 120, apiKeyLimit: 3,
    signupCredits: 10, renewalCredits: 0,
    recommendationCreditCost: 2, followupCreditCost: 1,
  },
  pro: {
    monthlyPriceAudCents: 699, minimumTopUpAudCents: null, creditsPerAud: 50,
    recommendationsDaily: 25, recommendationsMonthly: 250,
    followupsDaily: 50, followupsMonthly: 500, apiKeyLimit: 20,
    signupCredits: 0, renewalCredits: 50,
    recommendationCreditCost: 2, followupCreditCost: 1,
  },
  payg: {
    monthlyPriceAudCents: null, minimumTopUpAudCents: 500, creditsPerAud: 50,
    recommendationsDaily: null, recommendationsMonthly: null,
    followupsDaily: null, followupsMonthly: null, apiKeyLimit: 20,
    signupCredits: 0, renewalCredits: 0,
    recommendationCreditCost: 2, followupCreditCost: 1,
  },
} as const;

export type EntitlementPlan = keyof typeof V6_PLAN_RULES;
export type UsagePurpose = "recommendation" | "followup" | "api_recommend" | "api_recweather" | "api_weather" | "api_closet";
export const V6_API_COSTS = { api_recommend: 2, api_recweather: 3, api_weather: 1, api_closet: 1 } as const;
export const V6_RESET_TIME_ZONE = "UTC";
export const V6_FREE_MODEL_SWITCHES_DAILY = 2;
export const V6_CHECKOUT_AVAILABLE = false;
export const V6_ROLLOUT_NOTICE = "Approved V6 plans are not active yet. Your current account allowance remains in effect. Checkout and credit purchases are unavailable.";

export function formatAudCents(cents: number): string {
  return `A$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** Calendar-month period in UTC, clipping e.g. Jan 31 to Feb 28/29. */
export function nextUtcMonth(start: Date): Date {
  if (!Number.isFinite(start.getTime())) throw new Error("Invalid period start");
  const end = new Date(start);
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(start.getUTCDate(), lastDay));
  return end;
}

/** Require an explicit offset and reject normalized impossible calendar dates. */
export function parsePeriodTimestamp(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, zone] = match;
  const days = new Date(`${year}-${month}-01T00:00:00Z`);
  if (!Number.isFinite(days.getTime())) return null;
  days.setUTCMonth(days.getUTCMonth() + 1, 0);
  if (Number(day) < 1 || Number(day) > days.getUTCDate() || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59
    || (zone !== "Z" && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4, 6)) > 59))) return null;
  const result = new Date(value);
  return Number.isFinite(result.getTime()) ? result : null;
}

export function utcUsageWindow(at = new Date()) {
  if (!Number.isFinite(at.getTime())) throw new Error("Invalid usage time");
  const date = at.toISOString().slice(0, 10);
  const month = `${date.slice(0, 7)}-01`;
  const nextDay = new Date(at);
  nextDay.setUTCHours(24, 0, 0, 0);
  const nextMonth = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
  return { date, month, dailyResetAt: nextDay.toISOString(), monthlyResetAt: nextMonth.toISOString() };
}
