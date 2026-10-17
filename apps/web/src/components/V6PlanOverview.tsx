import Link from "next/link";
import { formatAudCents, V6_PLAN_RULES, V6_ROLLOUT_NOTICE } from "@/lib/entitlement-policy";

/** Approved-policy overview, not a live-entitlement or checkout offer. */
export default function V6PlanOverview() {
  const { free, pro, payg } = V6_PLAN_RULES;
  const plans = [
    { name: "Free", price: formatAudCents(free.monthlyPriceAudCents), items: [
      `${free.recommendationsDaily} recommendations/day and ${free.recommendationsMonthly}/month`,
      `${free.followupsDaily} follow-ups/day and ${free.followupsMonthly}/month`,
      `${free.apiKeyLimit} active API keys`, `${free.signupCredits} signup credits once per account, not per key`,
    ] },
    { name: "Pro", price: `${formatAudCents(pro.monthlyPriceAudCents)}/month`, items: [
      `${pro.recommendationsDaily} recommendations/day and ${pro.recommendationsMonthly}/month`,
      `${pro.followupsDaily} follow-ups/day and ${pro.followupsMonthly}/month`,
      `${pro.apiKeyLimit} active API keys`, `${pro.renewalCredits} credits per admin-managed monthly period; expire at its end`,
      "BYOK, custom prompts and custom weather sources",
    ] },
    { name: "Pay as you go", price: `${formatAudCents(payg.minimumTopUpAudCents)} minimum top-up`, items: [
      `${payg.creditsPerAud} credits per A$1`, `${payg.recommendationCreditCost} credits per standard recommendation`,
      `${payg.followupCreditCost} credit per follow-up`, `${payg.apiKeyLimit} active API keys`,
      "Purchased credits carry over; purchases unavailable",
    ] },
  ];
  return <div className="space-y-6" style={{ color: "var(--foreground)" }}>
    <div className="text-center space-y-2"><h2 className="text-2xl font-semibold">Approved V6 plans</h2><p className="text-sm opacity-65">{V6_ROLLOUT_NOTICE}</p></div>
    <div className="grid gap-5 md:grid-cols-3" aria-label="Approved V6 plan values">{plans.map((plan) => <article key={plan.name} className="rounded-3xl border p-6 space-y-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}><h3 className="text-xl font-semibold">{plan.name}</h3><p className="text-2xl font-bold">{plan.price}</p><ul className="list-disc pl-5 space-y-2 text-sm opacity-75">{plan.items.map((item) => <li key={item}>{item}</li>)}</ul></article>)}</div>
    <div className="text-sm opacity-65 space-y-2"><p>Closet and source setup/editing have no planned usage cap. Style, Shop and automatic AI generations share the recommendation allowance. Daily limits reset at 00:00 UTC; monthly limits use the UTC calendar month. Both caps apply. Included use does not also spend credits or silently switch to paid use.</p><p>App and API use share account credits with separate grant/purchased expiry rules after activation. Existing API costs remain: recommend 2, recweather 3, weather 1, closet 1; health 0. No premium-model or image charges are introduced.</p><p>Pro periods are set by an administrator for now, without automatic renewal or payment collection. A support donation is not a subscription, credit top-up or promise of access.</p></div>
    <div className="text-center"><Link href="/account" className="text-sm underline" style={{ color: "var(--accent)" }}>View your current account allowance</Link></div>
  </div>;
}
