import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ShopPanel from "../ShopPanel";
const props = { userId: "owner", isPro: false, isDev: false, userApiKey: "", byokProvider: "openai" as const, onApiKeyChange: () => {}, onProviderChange: () => {}, feedbackSummary: "", onSwitchToStyle: () => {} };
describe("Shop 6.1 configuration", () => {
  it("offers budget, size, occasion and the same account models, without affiliate links", () => {
    const markup = renderToStaticMarkup(createElement(ShopPanel, { ...props, hidden: true }));
    expect(markup).toContain('id="dashboard-shop-panel"'); expect(markup).toContain("hidden");
    expect(markup).toContain("Maximum shopping budget"); expect(markup).toContain("Size / fit"); expect(markup).toContain("AI model");
    expect(markup).toContain("https://www.theiconic.com.au/catalog/?q=outfits"); expect(markup).toContain('referrerPolicy="no-referrer"');
    expect(markup).not.toMatch(/utm_|aff_id|onClick=.*retailer/);
  });
  it("renders the reference outfit as escaped text, not AI-supplied product links", () => {
    const markup = renderToStaticMarkup(createElement(ShopPanel, { ...props, outfitIdea: '<a href="https://example.com">coat</a>' }));
    expect(markup).toContain("&lt;a href="); expect(markup).not.toContain('<a href="https://example.com"');
  });
  it("provides Anthropic BYOK only for Pro/developer controls", () => {
    expect(renderToStaticMarkup(createElement(ShopPanel, props))).not.toContain("API key</label>");
    const markup = renderToStaticMarkup(createElement(ShopPanel, { ...props, isPro: true }));
    expect(markup).toContain("anthropic"); expect(markup).toContain("Claude Haiku 4.5");
  });
  it("does not offer a dead Style link in a Shop-only workspace", () => {
    expect(renderToStaticMarkup(createElement(ShopPanel, { ...props, canSwitchToStyle: false }))).not.toContain("Back to Style");
  });
});
