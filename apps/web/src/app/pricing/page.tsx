import Link from "next/link";

const plans = [
  { name: "Free", price: "A$0", note: "For everyday weather-aware outfit checks.", items: ["5 AI recommendations each day", "Real-time multi-source weather", "Manual or GPS location", "Up to 3 active API keys"] },
  { name: "Pro", price: "A$4/month", note: "For more frequent planning and API work.", featured: true, items: ["Everything in Free", "50 App Credit refreshed weekly", "A$1 Credit each calendar month", "Up to 20 active API keys", "Custom prompts and weather sources"] },
  { name: "Pay as you go", price: "Coming soon", note: "Designed for flexible App Credit later on.", items: ["No purchase flow is live yet", "App Credit can be gifted by a developer", "Credit purchases currently open a support donation", "Details will be announced before launch"] },
];

export default function PricingPage() {
  return <main className="min-h-screen px-5 py-10 sm:py-16" style={{ background: "var(--background)", color: "var(--foreground)" }}>
    <div className="max-w-6xl mx-auto space-y-12">
      <header className="text-center space-y-4"><Link href="/" className="text-sm" style={{ color: "var(--accent)" }}>← Sky Style</Link><p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-55">Pricing</p><h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Simple plans, clear credits.</h1><p className="max-w-2xl mx-auto text-base sm:text-lg opacity-65">Sky Style keeps money credit, API Credit, and App Credit separate so you can see what each balance is for.</p></header>
      <section className="grid gap-5 md:grid-cols-3" aria-label="Sky Style plans">{plans.map((plan) => <article key={plan.name} className="rounded-3xl p-7 space-y-5" style={{ background: "var(--card)", border: plan.featured ? "2px solid var(--accent)" : "1px solid var(--card-border)" }}><div><h2 className="text-xl font-semibold">{plan.name}</h2><p className="text-3xl font-bold mt-2">{plan.price}</p><p className="text-sm mt-3 opacity-60">{plan.note}</p></div><ul className="space-y-3 text-sm opacity-75">{plan.items.map((item) => <li key={item}>✓ {item}</li>)}</ul>{plan.name === "Free" ? <Link href="/login" className="block rounded-xl px-4 py-3 text-center text-sm font-semibold btn-interact" style={{ border: "1px solid var(--card-border)" }}>Start free</Link> : plan.name === "Pro" ? <Link href="/account" className="block rounded-xl px-4 py-3 text-center text-sm font-semibold btn-interact" style={{ background: "var(--accent)", color: "#fff" }}>View account options</Link> : <a href="https://buymeacoffee.com/coolmanyt" target="_blank" rel="noreferrer" className="block rounded-xl px-4 py-3 text-center text-sm font-semibold btn-interact" style={{ border: "1px solid var(--card-border)" }}>Support Sky Style</a>}</article>)}</section>
      <p className="text-center text-sm opacity-55">$1.00 AUD Credit converts to 50 API Credit on the API Dashboard. Credit purchasing is not live yet.</p>
    </div>
  </main>;
}
