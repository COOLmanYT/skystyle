import { cleanEbayImageUrl, cleanEbayItemUrl, parseEbayProducts, parseShopInput, searchShop } from "../shop";
import { callAIWithModel } from "../ai";
jest.mock("../ai", () => ({ callAIWithModel: jest.fn(), getDefaultModel: () => ({ id: "gemini-2.5-flash" }) }));
const item = { itemId: "v1|123456789012|0", title: "Linen shirt", itemWebUrl: "https://www.ebay.com.au/itm/123456789012?campid=affiliate&utm_source=ad",
  image: { imageUrl: "https://i.ebayimg.com/images/g/abc/s-l1600.jpg?tracking=1" }, price: { value: "30.00", currency: "AUD" }, seller: { feedbackPercentage: "100" } };
describe("Grounded Shop sourcing", () => {
  beforeEach(() => { delete process.env.SHOP_SOURCE_APPROVED; delete process.env.EBAY_CLIENT_ID; delete process.env.EBAY_CLIENT_SECRET; (fetch as jest.Mock).mockReset(); (callAIWithModel as jest.Mock).mockReset(); });
  it("validates request types, region and budget ranges", () => {
    for (const raw of [null, [], {}, { query: 1 }, { query: "x", region: "US" }, { query: "x", recommendationContext: { budget: { minAmount: 50, maxAmount: 20, currency: "AUD" } } }]) expect(() => parseShopInput(raw)).toThrow();
    expect(parseShopInput({ query: " linen " }).query).toBe("linen");
  });
  it("only accepts direct allowed item URLs and drops all query tracking", () => {
    expect(cleanEbayItemUrl(item.itemWebUrl)).toBe("https://www.ebay.com.au/itm/123456789012");
    for (const url of ["http://www.ebay.com.au/itm/123456789012", "https://www.ebay.com.au.evil.test/itm/123456789012", "https://user@www.ebay.com.au/itm/123456789012", "https://www.ebay.com.au/checkout", "https://127.0.0.1/itm/123456789012"]) expect(cleanEbayItemUrl(url)).toBeNull();
    expect(cleanEbayImageUrl("https://evil.test/image.jpg")).toBeNull();
  });
  it("uses actual source metadata and never substitutes seller feedback for product ratings", () => {
    const [product] = parseEbayProducts({ itemSummaries: [item, item] }, "2026-09-28T00:00:00Z");
    expect(product.price).toEqual({ amount: 30, currency: "AUD" }); expect(product.rating).toBeNull();
    expect(product.url).not.toContain("?"); expect(product.image).not.toContain("?");
    expect(parseEbayProducts({ itemSummaries: [item, item] }, "now")).toHaveLength(1);
  });
  it("does not invent product details when missing", () => {
    const [product] = parseEbayProducts({ itemSummaries: [{ ...item, price: { value: "invalid", currency: "AUD" }, image: {} }] }, "now");
    expect(product.price).toBeNull(); expect(product.image).toBeNull(); expect(product.rating).toBeNull();
  });
  it("fails closed without approved source credentials and never calls AI", async () => {
    const result = await searchShop(parseShopInput({ query: "shirt" }), { isPro: false, isDev: false });
    expect(result.status).toBe("unconfigured"); expect(result.products).toEqual([]); expect(callAIWithModel).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  function source(items = [item]) {
    process.env.SHOP_SOURCE_APPROVED = "true"; process.env.EBAY_CLIENT_ID = "test-client"; process.env.EBAY_CLIENT_SECRET = "test-secret";
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "test-token", expires_in: 60 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ itemSummaries: items }) });
  }
  it("ranks only official source ids and retains actual price/image metadata", async () => {
    source();
    (callAIWithModel as jest.Mock).mockResolvedValue({ raw: JSON.stringify({ items: [{ id: "invented", price: 1 }, { id: item.itemId, reason: "Breathable", price: 999 }, { id: item.itemId }] }), modelUsed: "Gemini" });
    const result = await searchShop(parseShopInput({ query: "linen shirt" }), { isPro: false, isDev: false });
    expect(result.status).toBe("ok"); expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({ id: item.itemId, price: { amount: 30, currency: "AUD" }, rating: null, reason: "Breathable" });
    const [url, options] = (fetch as jest.Mock).mock.calls[1];
    expect(String(url)).toContain("https://api.ebay.com/buy/browse/v1/item_summary/search?");
    expect(options.headers["X-EBAY-C-MARKETPLACE-ID"]).toBe("EBAY_AU"); expect(options.redirect).toBe("error");
  });
  it("enforces the maximum over the whole selection and treats the minimum as advisory", async () => {
    const second = { ...item, itemId: "second", itemWebUrl: "https://www.ebay.com.au/itm/123456789013" };
    source([item, second]);
    (callAIWithModel as jest.Mock).mockResolvedValue({ raw: JSON.stringify({ items: [{ id: item.itemId }, { id: second.itemId }] }), modelUsed: "Gemini" });
    const result = await searchShop(parseShopInput({ query: "shirt", recommendationContext: { budget: { minAmount: 40, maxAmount: 50, currency: "AUD" } } }), { isPro: false, isDev: false });
    expect(result.products).toHaveLength(1); expect(result.budgetNote).toContain("less than your preferred minimum");
  });
  it("does not convert or relabel prices to match another budget currency", async () => {
    source();
    const result = await searchShop(parseShopInput({ query: "shirt", recommendationContext: { budget: { maxAmount: 100, currency: "USD" } } }), { isPro: false, isDev: false });
    expect(result.status).toBe("empty"); expect(callAIWithModel).not.toHaveBeenCalled();
  });
  it("fails safely when the source is down or AI invents all product ids", async () => {
    source(); (callAIWithModel as jest.Mock).mockResolvedValue({ raw: '{"items":[{"id":"invented"}]}', modelUsed: "Gemini" });
    await expect(searchShop(parseShopInput({ query: "shirt" }), { isPro: true, isDev: false, byokProvider: "anthropic", userApiKey: "user-test-key" })).rejects.toThrow("no valid sourced products");
    expect(callAIWithModel).toHaveBeenCalledWith(expect.any(String), expect.any(String), "user-test-key", false, "gemini-2.5-flash", "anthropic", 1200);
    (fetch as jest.Mock).mockReset().mockResolvedValue({ ok: false });
    await expect(searchShop(parseShopInput({ query: "shirt" }), { isPro: false, isDev: false })).rejects.toThrow("temporarily unavailable");
  });
});
