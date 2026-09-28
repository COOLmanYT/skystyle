import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ShopPanel from "../ShopPanel";

describe("Shop dashboard section", () => {
  it("offers a direct retailer search without affiliate or tracking parameters", () => {
    const markup = renderToStaticMarkup(createElement(ShopPanel, { onSwitchToStyle: () => {}, hidden: true }));

    expect(markup).toContain('id="dashboard-shop-panel"');
    expect(markup).toContain("hidden");
    expect(markup).toContain("Search THE ICONIC");
    expect(markup).toContain("https://www.theiconic.com.au/catalog/?q=outfits");
    expect(markup).toContain('referrerPolicy="no-referrer"');
    expect(markup).toContain("Verified product metadata, stock, prices, and currency conversion are not available yet");
  });

  it("shows an outfit idea as plain text rather than an unverified retailer link", () => {
    const markup = renderToStaticMarkup(createElement(ShopPanel, {
      outfitIdea: "Try <a href=\"https://example.com\">this coat</a>",
      onSwitchToStyle: () => {},
    }));

    expect(markup).toContain("Your latest outfit idea");
    expect(markup).toContain("&lt;a href=");
    expect(markup).not.toContain('<a href="https://example.com"');
    expect(markup).toContain("not a product listing or a verified shopping basket");
  });

  it("renders direct product widgets without inventing metadata or retaining tracking", () => {
    const markup = renderToStaticMarkup(createElement(ShopPanel, {
      outfitIdea: "[Linen shirt](https://www.theiconic.com.au/linen-shirt-1234.html?aff_id=123&utm_source=ai)",
      onSwitchToStyle: () => {},
    }));
    expect(markup).toContain("AI-suggested product links");
    expect(markup).toContain('href="https://www.theiconic.com.au/linen-shirt-1234.html"');
    expect(markup).toContain("Price: check retailer");
    expect(markup).toContain("Rating: not verified");
    expect(markup).not.toContain('href="https://www.theiconic.com.au/linen-shirt-1234.html?');
    expect(markup).not.toContain("<img");
  });
});
