"use client";
import { useState } from "react";
import Image from "next/image";
import { iconicSearchUrl } from "@/lib/retailer-search";
import { getAllModels, isModelAvailable, BYOK_PROVIDERS, type ByokProvider, type ModelID } from "@/lib/ai";
import { BUDGET_CURRENCIES, OCCASIONS, type BudgetCurrency, type Occasion } from "@/lib/recommendation-context";
import type { ShopProduct } from "@/lib/shop";

interface ShopPanelProps {
  userId: string; isPro: boolean; isDev: boolean; userApiKey: string; byokProvider: ByokProvider;
  onApiKeyChange: (key: string) => void; onProviderChange: (provider: ByokProvider) => void;
  feedbackSummary: string; outfitIdea?: string; onSwitchToStyle: () => void; canSwitchToStyle?: boolean; hidden?: boolean;
}
interface ShopResult { status: string; products: ShopProduct[]; message: string; budgetNote?: string; model: string | null; generatedAt: string; }
export default function ShopPanel({ isPro, isDev, userApiKey, byokProvider, onApiKeyChange, onProviderChange, feedbackSummary, outfitIdea, onSwitchToStyle, canSwitchToStyle = true, hidden }: ShopPanelProps) {
  const [query, setQuery] = useState(""), [size, setSize] = useState(""), [gender, setGender] = useState("");
  const [min, setMin] = useState(""), [max, setMax] = useState(""), [currency, setCurrency] = useState<BudgetCurrency>("AUD");
  const [occasion, setOccasion] = useState<Occasion>("everyday"), [customPrompt, setCustomPrompt] = useState("");
  const [model, setModel] = useState<ModelID | "">(""), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [result, setResult] = useState<ShopResult | null>(null);
  const fieldStyle = { background: "var(--background)", borderColor: "var(--card-border)" };
  const fieldClass = "mt-1 w-full rounded-xl border px-3 py-2.5 text-sm";
  async function search(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    if (min && (!max || Number(min) > Number(max))) { setError("Enter a maximum that is not below your minimum."); return; }
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/shop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, size, gender, region: "AU",
        recommendationContext: { occasion: { kind: occasion }, ...(feedbackSummary.trim() ? { feedbackSummary } : {}),
          ...(max ? { budget: { maxAmount: Number(max), ...(min ? { minAmount: Number(min) } : {}), currency } } : {}) },
        ...(model ? { modelId: model } : {}), ...(userApiKey ? { userApiKey, byokProvider } : {}),
        ...((isPro || isDev) && customPrompt.trim() ? { clientCustomPrompt: customPrompt } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed.");
      setResult(data);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Search unavailable."); }
    finally { setBusy(false); }
  }
  return <section id="dashboard-shop-panel" aria-labelledby="dashboard-shop-tab" hidden={hidden} className="mx-auto max-w-7xl space-y-6">
    <div className="rounded-3xl border p-5 sm:p-8" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--card)), var(--card))", borderColor: "var(--card-border)" }}>
      <p className="text-xs font-semibold uppercase tracking-widest opacity-60">Find your next favourite</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">A new outfit, your way.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed opacity-70">Describe what you need. Sky Style uses the same AI models as Style to rank sourced clothes for your preferences. No affiliate links, shopping click tracking, or checkout in Sky Style.</p>
      <p className="mt-2 text-xs opacity-60">Source coverage: Australia. Prices stay in their source currency; conversion is not enabled. Retailers control delivery, stock, returns and checkout.</p>
    </div>
    <form onSubmit={(event) => void search(event)} data-tour="shop-config" className="grid gap-5 rounded-3xl border p-5 sm:p-7 lg:grid-cols-2" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
      <label className="text-sm font-medium lg:col-span-2">What are you looking for?
        <input required maxLength={200} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. breathable linen shirt and trousers for a summer lunch" className={fieldClass} style={fieldStyle} />
      </label>
      <label className="text-sm font-medium">Size / fit<input maxLength={40} value={size} onChange={(event) => setSize(event.target.value)} placeholder="e.g. AU 10, relaxed fit" className={fieldClass} style={fieldStyle} /></label>
      <label className="text-sm font-medium">Clothing preference<input maxLength={40} value={gender} onChange={(event) => setGender(event.target.value)} placeholder="e.g. unisex, womenswear, menswear" className={fieldClass} style={fieldStyle} /></label>
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Total item budget range (optional)</legend>
        <div className="flex gap-2">
          <select aria-label="Shopping budget currency" value={currency} onChange={(event) => setCurrency(event.target.value as BudgetCurrency)} className="rounded-xl border px-2 text-sm" style={fieldStyle}>{BUDGET_CURRENCIES.map((code) => <option key={code}>{code}</option>)}</select>
          <input aria-label="Minimum shopping budget" type="number" min="0" max="1000000" step="0.01" value={min} onChange={(event) => setMin(event.target.value)} placeholder="Min" className={`${fieldClass} min-w-0`} style={fieldStyle} />
          <input aria-label="Maximum shopping budget" type="number" min="0.01" max="1000000" step="0.01" value={max} onChange={(event) => setMax(event.target.value)} placeholder="Max" className={`${fieldClass} min-w-0`} style={fieldStyle} />
        </div>
        <p className="text-xs opacity-60">Only matching source-currency prices count toward your maximum. Delivery and taxes may be extra; size availability must be checked at the retailer.</p>
      </fieldset>
      <label className="text-sm font-medium">Occasion<select value={occasion} onChange={(event) => setOccasion(event.target.value as Occasion)} className={fieldClass} style={fieldStyle}>{OCCASIONS.filter((value) => value !== "other").map((value) => <option key={value} value={value}>{value.replace("-", " ")}</option>)}</select></label>
      <label className="text-sm font-medium">AI model<select value={model} onChange={(event) => setModel(event.target.value as ModelID | "")} disabled={Boolean(userApiKey)} className={fieldClass} style={fieldStyle}>
        <option value="">{userApiKey ? `${byokProvider} · BYOK default` : "Same account default as Style"}</option>
        {getAllModels().filter((entry) => isModelAvailable(entry.id, isPro, isDev)).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
      </select></label>
      {(isPro || isDev) && <details className="rounded-xl border p-3" style={{ borderColor: "var(--card-border)" }}>
        <summary className="cursor-pointer text-sm font-medium">Bring your own key & AI preferences</summary>
        <label className="mt-3 block text-xs">Provider<select value={byokProvider} onChange={(event) => { const provider = event.target.value as ByokProvider; onProviderChange(provider); onApiKeyChange(""); try { localStorage.setItem("skystyle_byok_provider", provider); localStorage.removeItem("skystyle_byok_key"); } catch { /* optional storage */ } }} className={fieldClass} style={fieldStyle}>{BYOK_PROVIDERS.map((provider) => <option key={provider}>{provider}</option>)}</select></label>
        <label className="mt-2 block text-xs">API key<input type="password" autoComplete="off" maxLength={500} value={userApiKey} onChange={(event) => { onApiKeyChange(event.target.value); try { localStorage.setItem("skystyle_byok_key", event.target.value); } catch { /* optional storage */ } }} className={fieldClass} style={fieldStyle} /></label>
        <p className="mt-2 text-xs opacity-60">Shared with Style. Stored in this browser; transmitted through Sky Style only for requests to your selected provider, never saved in the database. Anthropic uses Claude Haiku 4.5.</p>
        <label className="mt-2 block text-xs">AI preferences<textarea maxLength={1000} rows={2} value={customPrompt} onChange={(event) => setCustomPrompt(event.target.value)} placeholder="e.g. Prefer natural fabrics and a short answer" className={fieldClass} style={fieldStyle} /></label>
      </details>}
      <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
        <button disabled={busy} className="rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "#fff" }}>{busy ? "Finding your items…" : "Find clothing with AI"}</button>
        <a href={iconicSearchUrl(query)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="text-sm underline">Direct retailer search</a>
        {canSwitchToStyle && <button type="button" onClick={onSwitchToStyle} className="text-sm underline">Back to Style</button>}
      </div>
      <p className="text-xs opacity-60 lg:col-span-2">A successful AI selection uses the same recommendation allowance or App Credit as Style. No charge for unavailable sources or empty results. Private preference summaries are included in the AI request.</p>
      {outfitIdea && <details className="lg:col-span-2"><summary className="cursor-pointer text-xs opacity-70">Reference your latest Style outfit</summary><p className="mt-2 whitespace-pre-line text-xs opacity-60">{outfitIdea.slice(0, 1500)}</p></details>}
    </form>
    {error && <p role="alert" className="rounded-xl border border-red-400 p-4 text-sm">{error}</p>}
    {result && <div className="space-y-4" aria-live="polite"><p className="text-sm opacity-75">{result.message}</p>{result.budgetNote && <p className="text-xs opacity-65">{result.budgetNote}</p>}
      {result.model && <p className="text-xs opacity-60">Ranked by {result.model}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{result.products.map((item) => <article key={item.id} className="overflow-hidden rounded-3xl border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="relative aspect-[4/5]" style={{ background: "var(--background)" }}>{item.image ? <Image src={item.image} alt={item.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-contain" /> : <div className="flex h-full items-center justify-center text-sm opacity-50">Image unavailable</div>}</div>
        <div className="space-y-2 p-4"><h2 className="text-sm font-semibold">{item.name}</h2>
          <p className="text-base font-semibold">{item.price ? new Intl.NumberFormat(undefined, { style: "currency", currency: item.price.currency }).format(item.price.amount) : "Price unavailable"}</p>
          {item.price && <p className="text-xs opacity-60">{item.price.currency} · source currency</p>}
          <p className="text-xs opacity-65">{item.rating ? `${item.rating.value}/${item.rating.best} (${item.rating.count} reviews)` : "Product rating unavailable"}</p>
          {item.reason && <p className="text-xs opacity-75">{item.reason}</p>}
          <p className="text-[11px] opacity-60">{item.source} · checked {new Date(item.checkedAt).toLocaleString()}</p>
          <a href={item.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-block py-2 text-sm font-medium underline">View at retailer ↗</a>
        </div>
      </article>)}</div>
    </div>}
  </section>;
}
