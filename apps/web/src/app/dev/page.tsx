import Link from "next/link";
import Tutorial from "@/components/Tutorial";
import { devNavigation } from "@/lib/dev-navigation";

const groups = [
  { name: "Support", icon: "◎", heading: "Help someone", description: "Start with the conversation or request that needs a response." },
  { name: "Monitoring", icon: "↗", heading: "Check the system", description: "Use health for connectivity and API activity for request failures." },
  { name: "Accounts", icon: "◷", heading: "Manage accounts", description: "Find a user before changing access, limits or account data." },
  { name: "Publishing", icon: "✎", heading: "Share an update", description: "Preview changelog content before making it public." },
] as const;

export const metadata = { title: "Overview — Dev Center" };
export default function DevLandingPage() {
  return <main id="main-content" className="space-y-8">
    <Tutorial id="dev-dashboard" title="Dev Center tour" steps={[
      { title: "Find your task", body: "Support, monitoring, accounts and publishing each have a dedicated workspace.", target: '[data-tour="dev-workspaces"]' },
      { title: "Keep your place", body: "Use the workspace navigation to move between tools. The current page stays highlighted.", target: 'aside' },
      { title: "Preview an update", body: "Review the Changelog preview before publishing.", target: 'a[href="/dev/changelog"]' },
    ]} />
    <header className="relative overflow-hidden rounded-3xl border p-6 sm:p-9" style={{ background: "linear-gradient(125deg, color-mix(in srgb, var(--accent) 14%, var(--card)), var(--card))", borderColor: "var(--card-border)" }}>
      <p className="text-xs font-semibold uppercase tracking-widest opacity-55">Sky Style · Developer workspace</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">What needs your attention?</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed opacity-65">One place for support, service checks and account tools. Choose a task below, or jump straight to a workspace.</p>
      <div className="mt-6 flex flex-wrap gap-3"><Link href="/dev/operations/feedback" className="rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: "var(--accent)", color: "white" }}>Open feedback tickets →</Link><Link href="/dev/health" className="rounded-xl border px-4 py-3 text-sm font-medium" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>Check service health</Link></div>
    </header>
    <div data-tour="dev-workspaces" className="grid gap-5 xl:grid-cols-2">{groups.map((group) => <section key={group.name} className="rounded-2xl border p-5 sm:p-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
      <div className="flex items-start gap-4"><span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ background: "color-mix(in srgb, var(--accent) 12%, var(--background))", color: "var(--accent)" }}>{group.icon}</span><div><h2 className="text-lg font-semibold">{group.heading}</h2><p className="mt-1 text-sm leading-relaxed opacity-60">{group.description}</p></div></div>
      <ul className="mt-5 space-y-1">{devNavigation.filter((item) => item.group === group.name).map((item) => <li key={item.href}><Link href={item.href} className="group flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-[var(--background)]"><div><span className="text-sm font-semibold">{item.label}</span><p className="mt-1 text-xs leading-relaxed opacity-60">{item.description}</p></div><span aria-hidden="true" className="opacity-40 transition-transform group-hover:translate-x-1">→</span></Link></li>)}</ul>
    </section>)}</div>
    <p className="px-1 text-xs leading-relaxed opacity-55">Developer access is restricted. Account changes and exports are audited; approving a deletion request does not itself delete the account.</p>
  </main>;
}
