/**
 * Validates a URL and returns it only if it uses a safe scheme.
 * Allows: http/https absolute URLs, and relative paths (/, ./, ../).
 * Returns null for unsafe schemes like javascript:, data:, vbscript:, etc.
 */
export function sanitizeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) return trimmed;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return null; // unsafe scheme
  return trimmed; // relative path with no scheme
}
