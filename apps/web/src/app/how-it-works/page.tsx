import Link from "next/link";

const steps = [
  ["1", "Choose a location", "Use GPS when it is useful, or type a place yourself. You stay in control of the location used for a recommendation."],
  ["2", "Read the weather picture", "Sky Style combines the details that change an outfit: temperature, rain chance, wind, UV, alerts, and the time of day."],
  ["3", "Make it yours", "Save clothes in your closet, ask follow-up questions, and keep recommendations you want to return to later."],
];

export default function HowItWorksPage() {
  return <main className="min-h-screen px-5 py-10 sm:py-16" style={{ background: "var(--background)", color: "var(--foreground)" }}>
    <div className="max-w-4xl mx-auto space-y-12">
      <header className="text-center space-y-4">
        <Link href="/" className="text-sm" style={{ color: "var(--accent)" }}>← Sky Style</Link>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-55">How it works</p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">A calmer way to decide what to wear.</h1>
        <p className="max-w-2xl mx-auto text-base sm:text-lg opacity-65">Weather information is useful only when it helps you make a decision. Sky Style turns the forecast into a practical starting point, then lets you refine it.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3" aria-label="How Sky Style works">
        {steps.map(([number, title, description]) => <article key={number} className="rounded-2xl p-6 space-y-4" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
          <span className="inline-flex w-8 h-8 items-center justify-center rounded-full text-sm font-bold" style={{ background: "var(--accent)", color: "#fff" }}>{number}</span>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm leading-relaxed opacity-65">{description}</p>
        </article>)}
      </section>

      <section className="rounded-3xl p-7 sm:p-10 grid gap-6 md:grid-cols-[1.2fr_0.8fr] items-center" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        <div className="space-y-3"><p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-55">Beyond one recommendation</p><h2 className="text-2xl font-semibold">Plan around your actual life.</h2><p className="text-sm leading-relaxed opacity-65">Use automatic recommendations for a planned time, keep a useful wardrobe list, and return to a saved result for follow-up questions when conditions change.</p></div>
        <div className="flex flex-col gap-2"><Link href="/login" className="rounded-xl px-4 py-3 text-sm font-semibold text-center btn-interact" style={{ background: "var(--accent)", color: "#fff" }}>Get started free</Link><Link href="/#demo" className="rounded-xl px-4 py-3 text-sm font-semibold text-center btn-interact" style={{ border: "1px solid var(--card-border)" }}>Try the live weather demo</Link></div>
      </section>
    </div>
  </main>;
}
