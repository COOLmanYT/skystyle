"use client";

import { useState } from "react";
import { iconicSearchUrl } from "@/lib/retailer-search";
import { extractProductLinks } from "@/lib/product-links";

interface ShopPanelProps {
  outfitIdea?: string;
  onSwitchToStyle: () => void;
  hidden?: boolean;
}

export default function ShopPanel({ outfitIdea, onSwitchToStyle, hidden = false }: ShopPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const suggestedLinks = extractProductLinks(outfitIdea ?? "");
  return (
    <section
      id="dashboard-shop-panel"
      aria-labelledby="dashboard-shop-tab"
      className="mx-auto max-w-7xl space-y-5"
      hidden={hidden}
    >
      <div
        className="rounded-2xl border p-5 sm:p-7"
        style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest opacity-55">New outfits</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Shop</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed opacity-75">
          Browse new outfits on THE ICONIC Australia. This opens a direct retailer search with no
          Sky Style affiliate link, referral code, or click tracking. Prices, stock, and checkout
          are handled by the retailer, not verified by Sky Style.
        </p>
      </div>
      {suggestedLinks.length > 0 && (
        <div className="rounded-2xl border p-5 sm:p-7"
          style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <h2 className="text-lg font-semibold">AI-suggested product links</h2>
          <p className="mt-2 text-xs opacity-65">
            These links came from the outfit text. Sky Style has not verified that the products exist,
            are in stock, or have a current price or rating. Check the retailer before buying.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {suggestedLinks.map((item) => (
              <article key={item.url} className="rounded-xl border p-3"
                style={{ background: "var(--background)", borderColor: "var(--card-border)" }}>
                <div aria-hidden="true" className="flex h-24 items-center justify-center rounded-lg text-3xl"
                  style={{ background: "var(--card)" }}>👕</div>
                <h3 className="mt-2 text-sm font-semibold">{item.name}</h3>
                <p className="mt-1 text-xs opacity-60">Price: check retailer</p>
                <p className="text-xs opacity-60">Rating: not verified</p>
                <a href={item.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
                  className="mt-2 inline-block text-xs font-semibold underline">View at THE ICONIC ↗</a>
              </article>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div
          className="rounded-2xl border p-5 sm:p-7"
          style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
        >
          <h2 className="text-lg font-semibold">Find something new</h2>
          <label htmlFor="shop-search" className="mt-3 block text-sm opacity-75">
            What are you shopping for?
          </label>
          <input
            id="shop-search"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="e.g. linen shirt, winter coat"
            maxLength={120}
            className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm"
            style={{ background: "var(--background)", borderColor: "var(--card-border)" }}
          />
          <a
            href={iconicSearchUrl(searchTerm)}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className="mt-4 inline-flex rounded-xl px-4 py-2.5 text-sm font-semibold btn-interact"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Search THE ICONIC ↗
          </a>
          <p className="mt-3 text-xs opacity-60">
            You leave Sky Style when you open the retailer. Its own privacy and shopping terms apply.
          </p>
        </div>
        <div
          className="rounded-2xl border p-5 sm:p-7"
          style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
        >
          <h2 className="text-lg font-semibold">Start with an outfit idea</h2>
          <p className="mt-2 text-sm leading-relaxed opacity-70">
            Style can plan an outfit around your weather, occasion, budget guide, and fragrance preferences.
            It does not verify that any item is for sale.
          </p>
          <button
            type="button"
            onClick={onSwitchToStyle}
            className="mt-5 rounded-xl px-4 py-2.5 text-sm font-semibold btn-interact"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Go to Style
          </button>
        </div>

        <div
          className="rounded-2xl border p-5 sm:p-7"
          style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
        >
          <h2 className="text-lg font-semibold">{outfitIdea ? "Your latest outfit idea" : "Your shopping plan"}</h2>
          {outfitIdea ? (
            <>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{outfitIdea}</p>
              <p className="mt-4 text-xs opacity-60">
                This is AI-generated style advice, not a product listing or a verified shopping basket.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm leading-relaxed opacity-70">
              Generate an outfit in Style, then come back here to keep that idea in view while shopping is being built.
            </p>
          )}
        </div>
      </div>
      <p className="text-xs opacity-60">
        Verified product metadata, stock, prices, and currency conversion are not available yet.
      </p>
    </section>
  );
}
