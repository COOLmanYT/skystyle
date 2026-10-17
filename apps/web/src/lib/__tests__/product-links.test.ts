import { extractProductLinks } from "../product-links";

describe("AI-suggested product links", () => {
  it("keeps direct Australian retailer pages but removes query tracking", () => {
    expect(extractProductLinks(
      "Try [Navy jacket](https://www.theiconic.com.au/navy-jacket-123.html?utm_source=ai&affiliate=1#details)",
    )).toEqual([{ name: "Navy jacket", url: "https://www.theiconic.com.au/navy-jacket-123.html" }]);
  });

  it("rejects redirects, foreign hosts, catalog links, and duplicate pages", () => {
    expect(extractProductLinks([
      "[Bad](https://example.com/redirect?to=theiconic.com.au)",
      "[Search](https://www.theiconic.com.au/catalog/?q=coat)",
      "[Cart](https://www.theiconic.com.au/cart/)",
      "[Coat](https://www.theiconic.com.au/coat-123.html)",
      "[Same coat](https://www.theiconic.com.au/coat-123.html?ref=abc)",
    ].join(" "))).toEqual([{ name: "Coat", url: "https://www.theiconic.com.au/coat-123.html" }]);
  });
});
