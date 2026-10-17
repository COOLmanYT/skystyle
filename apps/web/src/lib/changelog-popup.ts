/** The changelog API returns published entries newest first. Older posts never become login popups. */
export function selectLatestLoginPopup<T extends { version: string; showOnNextLogin?: boolean }>(
  entries: readonly T[],
  seenVersions: readonly string[],
): T | null {
  const latest = entries[0];
  return latest?.showOnNextLogin && !seenVersions.includes(latest.version) ? latest : null;
}
