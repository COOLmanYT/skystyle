/** A direct, untracked search on an Australian retailer's own website. */
export function iconicSearchUrl(query: string): string {
  const cleaned = query.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 120);
  const url = new URL("https://www.theiconic.com.au/catalog/");
  url.searchParams.set("q", cleaned || "outfits");
  return url.toString();
}
