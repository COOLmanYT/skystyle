/** Current allowances when account-based accounting is disabled. */
export const LEGACY_LIMITS = {
  free: { ai_uses: 20, follow_ups: 40, closet_uses: 4, source_picks: 4, model_switches: 2 },
  demo: { ai_uses: 200, follow_ups: 400, closet_uses: 40, source_picks: 40, model_switches: 20 },
  pro: { ai_uses: Infinity, follow_ups: 400, closet_uses: Infinity, source_picks: Infinity, model_switches: Infinity },
  dev: { ai_uses: Infinity, follow_ups: Infinity, closet_uses: Infinity, source_picks: Infinity, model_switches: Infinity },
} as const;
export const LEGACY_DAILY_APP_CREDITS = 50;
