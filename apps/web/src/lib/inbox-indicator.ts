const POLL_INTERVAL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRY_MS = 300_000;

/** Navigation only: keep private inbox contents out of the badge response. */
export function startInboxIndicatorPolling(onUnread: (unread: boolean) => void): () => void {
  let stopped = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let request: AbortController | undefined;
  const isHidden = () => document.visibilityState === "hidden";

  function clearTimer() {
    clearTimeout(timer);
    timer = undefined;
  }

  async function poll() {
    if (stopped || isHidden() || request) return;
    clearTimer();
    const controller = new AbortController();
    request = controller;
    const startedAt = Date.now();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch("/api/inbox?view=unread", {
        cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) throw new Error("Inbox indicator unavailable.");
      const data = await response.json();
      if (typeof data.unread !== "boolean") throw new Error("Invalid inbox indicator.");
      if (stopped || controller.signal.aborted || request !== controller) return;
      failures = 0;
      onUnread(data.unread);
    } catch {
      if (!stopped && request === controller) failures += 1;
      // Preserve the previous badge on failure; navigation remains usable.
    } finally {
      clearTimeout(timeout);
      if (request === controller) {
        request = undefined;
        if (!stopped && !isHidden()) {
          const interval = Math.min(POLL_INTERVAL_MS * 2 ** Math.min(failures, 3), MAX_RETRY_MS);
          timer = setTimeout(() => void poll(), Math.max(0, interval - (Date.now() - startedAt)));
        }
      }
    }
  }

  function visibilityChanged() {
    clearTimer();
    if (isHidden()) {
      const previous = request;
      request = undefined;
      previous?.abort();
    } else {
      void poll();
    }
  }

  document.addEventListener("visibilitychange", visibilityChanged);
  void poll();
  return () => {
    stopped = true;
    clearTimer();
    document.removeEventListener("visibilitychange", visibilityChanged);
    request?.abort();
    request = undefined;
  };
}
