import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MarkdownRenderer from "../MarkdownRenderer";
import ClosetManager from "../ClosetManager";
import ShopPanel from "../ShopPanel";
describe("Clothing links across recommendation formatting", () => {
  it("links owned names inside bold text and table cells, without substring matches", () => {
    const markup = renderToStaticMarkup(createElement(MarkdownRenderer, { content: "**Coat** and raincoat\n\n| Outfit |\n| --- |\n| **Coat** |", closetItems: ["Coat"], recommendationLinks: true }));
    expect(markup.match(/href="\/closet\?highlight=Coat"/g)).toHaveLength(2);
    expect(markup.replace(/<[^>]*>/g, "")).toContain("raincoat");
  });
  it("renders encoded, owned and nonowned AI links with canonical destinations", () => {
    const markup = renderToStaticMarkup(createElement(MarkdownRenderer, { content: "[coat](/dashboard?section=shop&item=coat) and [linen shirt](/dashboard?section=shop&item=linen%20shirt)", closetItems: ["Coat"], recommendationLinks: true }));
    expect(markup).toContain('/closet?highlight=Coat'); expect(markup).toContain('section=shop&amp;item=linen%20shirt');
    expect(markup).toContain('aria-label="Find linen shirt in Shop"');
  });
  it("renders invalid actions safely without a clickable target", () => {
    const markup = renderToStaticMarkup(createElement(MarkdownRenderer, { content: "[bad](/dashboard?section=shop&item=%00) [unsafe](//evil.test)", recommendationLinks: true }));
    expect(markup).not.toContain("href=");
  });
  it("supports distinct closet IDs and a removed-item notice", () => {
    const markup = renderToStaticMarkup(createElement(ClosetManager, { initialItems: ["A+B", "A B"], highlight: "removed" }));
    expect(markup).toContain('id="closet-item-a%2Bb"'); expect(markup).toContain('id="closet-item-a%20b"');
    expect(markup).toContain("no longer in your closet"); expect(markup).toContain('tabindex="-1"');
  });
  it("fills Shop context without making a request", () => {
    const markup = renderToStaticMarkup(createElement(ShopPanel, { userId: "owner", isPro: false, isDev: false, userApiKey: "", byokProvider: "openai", onApiKeyChange: () => {}, onProviderChange: () => {}, feedbackSummary: "", onSwitchToStyle: () => {}, contextItem: { item: "Linen shirt", sequence: 1 } }));
    expect(markup).toContain('value="Linen shirt"'); expect(markup).toContain("Clear item context");
    expect(fetch).not.toHaveBeenCalled();
  });
});
