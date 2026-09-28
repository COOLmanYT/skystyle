export interface ProductLinkSuggestion {
  name: string;
  url: string;
}

/** AI text can suggest links, but it cannot attest to price, rating, image, or stock. */
export function extractProductLinks(outfit: string): ProductLinkSuggestion[] {
  const suggestions: ProductLinkSuggestion[] = [];
  const seen = new Set<string>();
  const links = /\[([^\]]{1,100})\]\((https?:\/\/[^\s)]+)\)/g;
  for (const match of outfit.matchAll(links)) {
    if (suggestions.length >= 4) break;
    try {
      const parsed = new URL(match[2]);
      if (parsed.protocol !== "https:" || parsed.origin !== "https://www.theiconic.com.au"
        || parsed.username || parsed.password || parsed.pathname === "/"
        || parsed.pathname.startsWith("/catalog")
        || /\/(?:account|cart|checkout|login)(?:\/|$)/i.test(parsed.pathname)) continue;
      // Rebuild a direct link. Never preserve tracking, affiliate, or fragment data from AI output.
      const url = new URL(parsed.pathname, parsed.origin).toString();
      if (seen.has(url)) continue;
      seen.add(url);
      suggestions.push({ name: match[1].trim().slice(0, 80), url });
    } catch {
      // Ignore malformed or unsafe URLs.
    }
  }
  return suggestions;
}
