import { iconicSearchUrl } from "../retailer-search";

describe("Australian retailer search", () => {
  it("uses only a direct retailer query, with no tracking or affiliate parameters", () => {
    const url = new URL(iconicSearchUrl("linen shirt"));
    expect(url.origin).toBe("https://www.theiconic.com.au");
    expect(url.pathname).toBe("/catalog/");
    expect([...url.searchParams.entries()]).toEqual([["q", "linen shirt"]]);
  });

  it("removes control characters and limits a pasted query", () => {
    const url = new URL(iconicSearchUrl("  coat\n" + "x".repeat(200)));
    expect(url.searchParams.get("q")).toBe("coat " + "x".repeat(115));
  });

  it("falls back to a generic outfit search", () => {
    expect(new URL(iconicSearchUrl("   ")).searchParams.get("q")).toBe("outfits");
  });
});
