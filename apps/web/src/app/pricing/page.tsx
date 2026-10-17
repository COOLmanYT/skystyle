import Link from "next/link";
import V6PlanOverview from "@/components/V6PlanOverview";

export default function PricingPage() {
  return <main className="min-h-screen px-5 py-10 sm:py-16" style={{ background: "var(--background)", color: "var(--foreground)" }}>
    <div className="max-w-6xl mx-auto space-y-10"><header className="text-center space-y-3"><Link href="/" className="text-sm" style={{ color: "var(--accent)" }}>← Sky Style</Link><h1 className="text-4xl font-bold tracking-tight">Clear plans, no surprise charges.</h1><p className="text-sm opacity-65">All prices are in Australian dollars. The approved policy below is staged, not activated.</p></header><V6PlanOverview /></div>
  </main>;
}
