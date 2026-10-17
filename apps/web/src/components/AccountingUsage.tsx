import type { DailyLimitsInfo } from "@/lib/daily-usage";

/** The monthly cap is independent of the daily cap; never add the two. */
export default function AccountingUsage({ limits }: { limits: DailyLimitsInfo }) {
  return <section aria-label="Included account usage" className="space-y-2 text-xs">
    {[ ["Recommendations (Style + Shop + automatic)", limits.ai], ["Follow-ups", limits.followUps] ].map(([label, counter]) => {
      const usage = counter as DailyLimitsInfo["ai"];
      return <p key={String(label)}><strong>{String(label)}</strong>: {usage.used}/{usage.limit ?? "∞"} today · {usage.monthlyUsed ?? 0}/{usage.monthlyLimit ?? "∞"} this UTC month</p>;
    })}
    <p>Daily reset: {limits.dailyResetAt} · Monthly reset: {limits.monthlyResetAt}</p>
    <p>Included requests do not spend credits. Holds count until completed or released; credit-funded requests are separate.</p>
  </section>;
}
