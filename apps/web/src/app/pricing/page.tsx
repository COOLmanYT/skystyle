import Link from "next/link";
import PlanOverview from "@/components/PlanOverview";

export default function PricingPage() {
  return <main className="min-h-screen px-5 py-10 sm:py-16" style={{ background: "var(--background)", color: "var(--foreground)" }}>
    <div className="max-w-6xl mx-auto space-y-10"><header className="text-center space-y-3"><Link href="/" className="text-sm" style={{ color: "var(--accent)" }}>← Sky Style</Link><h1 className="text-4xl font-bold tracking-tight">Clear plans, no surprise charges.</h1><p className="text-sm opacity-65">Choose the allowance that suits your day. Account access is managed separately from purchases.</p></header><PlanOverview /></div>
  </main>;
}
