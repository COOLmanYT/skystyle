"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { V6_PLAN_RULES } from "@/lib/entitlement-policy";
import { LEGACY_LIMITS, LEGACY_DAILY_APP_CREDITS } from "@/lib/legacy-allowances";

export default function PlanOverview({ accountingEnabled }: { accountingEnabled?: boolean | null }) {
  const [verified, setVerified] = useState<boolean | null | undefined>(accountingEnabled);
  useEffect(() => {
    if (accountingEnabled !== undefined) return;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    fetch("/api/plans", { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok || typeof data.accountingEnabled !== "boolean") throw new Error();
      if (active) setVerified(data.accountingEnabled);
    }).catch(() => { if (active) setVerified(null); }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [accountingEnabled]);
  const mode = accountingEnabled !== undefined ? accountingEnabled : verified;
  const plans = mode ? [
    { name: "Free", price: "A$0", items: [`${V6_PLAN_RULES.free.recommendationsDaily} recommendations/day and ${V6_PLAN_RULES.free.recommendationsMonthly}/month`, `${V6_PLAN_RULES.free.followupsDaily} follow-ups/day and ${V6_PLAN_RULES.free.followupsMonthly}/month`, `${V6_PLAN_RULES.free.apiKeyLimit} active API keys`, "Your closet and saved outfits"] },
    { name: "Pro", price: "Managed access", items: [`${V6_PLAN_RULES.pro.recommendationsDaily} recommendations/day and ${V6_PLAN_RULES.pro.recommendationsMonthly}/month`, `${V6_PLAN_RULES.pro.followupsDaily} follow-ups/day and ${V6_PLAN_RULES.pro.followupsMonthly}/month`, `${V6_PLAN_RULES.pro.renewalCredits} credits per monthly account period`, "Your own provider key, custom prompts and weather sources"] },
    { name: "Credit-funded use", price: "Use available credits", items: [`${V6_PLAN_RULES.payg.recommendationCreditCost} credits per standard recommendation`, `${V6_PLAN_RULES.payg.followupCreditCost} credit per follow-up`, "Credit purchases are unavailable"] },
  ] : [
    { name: "Free", price: "A$0", items: [`${LEGACY_LIMITS.free.ai_uses} recommendations/day`, `${LEGACY_LIMITS.free.follow_ups} follow-ups/day`, "Your closet and saved outfits"] },
    { name: "Pro", price: "Managed access", items: [`${LEGACY_DAILY_APP_CREDITS} App Credits/day for recommendations`, `${LEGACY_LIMITS.pro.follow_ups} follow-ups/day`, "Your own provider key, custom prompts and weather sources"] },
  ];
  return <section className="space-y-6" aria-label="Plans and allowances">
    <div className="text-center space-y-2"><h2 className="text-2xl font-semibold">Plans & allowances</h2><p className="text-sm opacity-70">Checkout and credit purchases are unavailable. Your account page shows your available allowance.</p></div>
    {mode === undefined ? <p role="status" className="text-center text-sm">Checking plan availability…</p> : mode === null ? <p role="status" className="text-center text-sm">Plan details are temporarily unavailable. Check your account before making a request.</p> : <>
      <div className={`grid gap-4 ${mode ? "lg:grid-cols-3" : "sm:grid-cols-2"}`}>{plans.map(plan => <article key={plan.name} className="min-w-0 space-y-4 rounded-2xl border p-5 sm:p-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}><h3 className="text-xl font-semibold">{plan.name}</h3><p className="text-2xl font-bold">{plan.price}</p><ul className="list-disc space-y-2 pl-5 text-sm opacity-80">{plan.items.map(item => <li key={item}>{item}</li>)}</ul></article>)}</div>
      <p className="text-sm leading-relaxed opacity-70">These are default allowances; account restrictions may differ. Style, Shop and automatic recommendations share the recommendation allowance. Daily counters reset at midnight UTC.{mode ? " Monthly counters reset at the start of the UTC calendar month; both caps apply." : " Pro App Credits reset daily."} Pro access is managed for your account. Donations do not buy access or credits.</p>
    </>}
    <div className="text-center"><Link href="/account" className="control-button text-sm underline">View your account allowance</Link></div>
  </section>;
}
