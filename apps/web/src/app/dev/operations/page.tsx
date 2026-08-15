import Link from "next/link";
import DevOperationsNav from "@/components/DevOperationsNav";

const sections = [
  { href: "/dev/operations/api-activity", title: "API Activity", description: "Review all API requests, failures, response time, error codes, and captured diagnostics.", icon: "📡" },
  { href: "/dev/operations/users", title: "Users", description: "Search and order users, manage limits, export user data, and safely delete accounts.", icon: "👥" },
  { href: "/dev/operations/feedback", title: "Feedback", description: "Reply to support tickets with the sender, source, and submission time in context.", icon: "💬" },
];

export default function DevOperationsPage() {
  return <main className="min-h-screen p-4 md:p-8" style={{ background: "var(--background)" }}><div className="mx-auto max-w-5xl space-y-7"><Link href="/dev" className="text-sm" style={{ color: "var(--accent)" }}>← Dev Center</Link><div><h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Operations</h1><p className="mt-1 text-sm" style={{ color: "var(--foreground)", opacity: .58 }}>Choose a focused operations workspace. Actions are server-verified and audited.</p></div><DevOperationsNav current="overview" /><div className="grid gap-4 md:grid-cols-3">{sections.map((section) => <Link key={section.href} href={section.href} className="rounded-2xl p-5 btn-interact" style={{ background: "var(--card)", border: "1px solid var(--card-border)", textDecoration: "none" }}><span className="text-3xl">{section.icon}</span><h2 className="mt-3 text-lg font-semibold" style={{ color: "var(--foreground)" }}>{section.title}</h2><p className="mt-2 text-sm" style={{ color: "var(--foreground)", opacity: .6 }}>{section.description}</p></Link>)}</div></div></main>;
}
