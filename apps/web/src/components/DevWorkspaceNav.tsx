"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeDevDestination, devNavigation } from "@/lib/dev-navigation";

export default function DevWorkspaceNav() {
  const pathname = usePathname();
  const active = activeDevDestination(pathname);
  const groups = [...new Set(devNavigation.map((item) => item.group))];
  const links = <nav aria-label="Dev Center workspaces" className="space-y-5">
    {groups.map((group) => <div key={group}><p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest opacity-50">{group}</p>
      <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">{devNavigation.filter((item) => item.group === group).map((item) => <li key={item.href}>
        <Link href={item.href} aria-current={active.href === item.href ? "page" : undefined}
          className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-[var(--background)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          style={{ background: active.href === item.href ? "color-mix(in srgb, var(--accent) 14%, var(--card))" : undefined, color: "var(--foreground)", fontWeight: active.href === item.href ? 600 : 400 }}>
          {item.label}{active.href === item.href && <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />}
        </Link></li>)}</ul></div>)}
    <Link href="/dashboard" className="block border-t px-3 pt-4 text-sm opacity-65 hover:opacity-100" style={{ borderColor: "var(--card-border)" }}>← Back to Sky Style</Link>
  </nav>;
  return <aside className="self-start lg:sticky lg:top-24" style={{ color: "var(--foreground)" }}>
    <div className="hidden rounded-2xl border p-3 lg:block" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>{links}</div>
    <details key={pathname} className="rounded-2xl border p-4 lg:hidden" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
      <summary className="cursor-pointer text-sm font-semibold">Navigate · {active.label}</summary><div className="mt-5">{links}</div>
    </details>
  </aside>;
}
