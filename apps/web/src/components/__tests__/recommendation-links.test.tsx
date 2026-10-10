import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MarkdownRenderer from "../MarkdownRenderer";
import ClosetManager from "../ClosetManager";
import ShopPanel from "../ShopPanel";
import { clothingReference } from "@/lib/recommendation-links";
import { newWardrobeItem } from "@/lib/wardrobe";
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
    const wardrobeItems = [newWardrobeItem("11111111-1111-4111-8111-111111111111", "Coat"), newWardrobeItem("22222222-2222-4222-8222-222222222222", "Coat")];
    const markup = renderToStaticMarkup(createElement(ClosetManager, { initialItems: [], initialSnapshot: { items: ["Coat", "Coat"], wardrobeItems, revision: 3 }, highlight: "removed" }));
    expect(markup).toContain('id="closet-item-11111111-1111-4111-8111-111111111111"'); expect(markup).toContain('id="closet-item-22222222-2222-4222-8222-222222222222"');
    expect(markup).toContain("no longer in your closet"); expect(markup).toContain('tabindex="-1"');
  });
  it("highlights stable clothing references and uses the current owned label after a rename", () => {
    const item = { ...newWardrobeItem("11111111-1111-4111-8111-111111111111", "Renamed coat"), available: false };
    const markup = renderToStaticMarkup(createElement(MarkdownRenderer, { content: clothingReference("Old coat", item.id), wardrobeItems: [item], recommendationLinks: true }));
    expect(markup).toContain("clothing-reference-owned");
    expect(markup).toContain(`highlight=${item.id}`);
    expect(markup).toContain("Renamed coat</a>");
    expect(markup).not.toContain("Old coat</a>");
  });
  it("handles escaped labels, punctuation and a deleted ID without exposing a custom URI", () => {
    const name = "Coat [蓝色] (rain) *warm*";
    const markup = renderToStaticMarkup(createElement(MarkdownRenderer, { content: clothingReference(name, "11111111-1111-4111-8111-111111111111"), recommendationLinks: true }));
    expect(markup).toContain("section=shop&amp;item=Coat%20%5B");
    expect(markup).toContain(name + "</a>");
    expect(markup).not.toContain('href="clothing:');
  });
  it("keeps clothing references as text outside recommendations or while inventory is unavailable", () => {
    const markup = renderToStaticMarkup(createElement(MarkdownRenderer, { content: "[Coat](clothing:Coat) [Bad](clothing:id/not-a-uuid)" }));
    expect(markup).not.toContain("href="); expect(markup).not.toContain("clothing:");
  });
  it("keeps punctuation inside a clothing reference in one Markdown table cell", () => {
    const markup = renderToStaticMarkup(createElement(MarkdownRenderer, { content: `| Item |\n| --- |\n| ${clothingReference("Coat | shell")} |`, recommendationLinks: true }));
    expect(markup.match(/<td/g)).toHaveLength(1);
    expect(markup).toContain("Coat | shell</a>");
    expect(markup).toContain("item=Coat%20%7C%20shell");
  });
  it("does not link stale plain names when a recommendation explicitly disables inventory actions", () => {
    const markup = renderToStaticMarkup(createElement(MarkdownRenderer, { content: "Coat", closetItems: ["Coat"], recommendationLinks: false }));
    expect(markup).not.toContain("href=");
  });
  it("fills Shop context without making a request", () => {
    const markup = renderToStaticMarkup(createElement(ShopPanel, { userId: "owner", isPro: false, isDev: false, userApiKey: "", byokProvider: "openai", onApiKeyChange: () => {}, onProviderChange: () => {}, feedbackSummary: "", onSwitchToStyle: () => {}, contextItem: { item: "Linen shirt", sequence: 1 } }));
    expect(markup).toContain('value="Linen shirt"'); expect(markup).toContain("Clear item context");
    expect(fetch).not.toHaveBeenCalled();
  });
});
