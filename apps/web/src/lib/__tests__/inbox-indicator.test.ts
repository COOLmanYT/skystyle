import { startInboxIndicatorPolling } from "../inbox-indicator";

class Visibility extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";
  change(state: DocumentVisibilityState) {
    this.visibilityState = state;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}
const response = (unread: boolean) => new Response(JSON.stringify({ unread }));
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

describe("Inbox badge polling", () => {
  let visibility: Visibility;
  let fetchMock: jest.SpyInstance;
  let stop: (() => void) | undefined;
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  beforeEach(() => {
    jest.useFakeTimers();
    visibility = new Visibility();
    Object.defineProperty(globalThis, "document", { configurable: true, value: visibility });
    fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(response(true));
  });
  afterEach(() => {
    stop?.(); stop = undefined;
    jest.useRealTimers();
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
    else Reflect.deleteProperty(globalThis, "document");
  });

  it("keeps the visible one-minute cadence and requests no message bodies", async () => {
    const unread = jest.fn();
    stop = startInboxIndicatorPolling(unread);
    await flush();
    expect(unread).toHaveBeenLastCalledWith(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/inbox?view=unread", expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }));
    await jest.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("makes no requests while initially hidden and refreshes immediately on return", async () => {
    visibility.change("hidden");
    stop = startInboxIndicatorPolling(jest.fn());
    await jest.advanceTimersByTimeAsync(300_000);
    expect(fetchMock).not.toHaveBeenCalled();
    visibility.change("visible"); await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    visibility.change("hidden");
    await jest.advanceTimersByTimeAsync(300_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    visibility.change("visible"); await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborts hidden requests and ignores late responses from the previous request", async () => {
    let resolveOld!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { resolveOld = resolve; }));
    const unread = jest.fn();
    stop = startInboxIndicatorPolling(unread);
    const oldSignal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    visibility.change("hidden");
    expect(oldSignal.aborted).toBe(true);
    visibility.change("visible"); await flush();
    expect(unread).toHaveBeenLastCalledWith(true);
    resolveOld(response(false)); await flush();
    expect(unread).toHaveBeenCalledTimes(1);
    stop();
    await jest.advanceTimersByTimeAsync(300_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("backs off failures without clearing the previous unread indicator", async () => {
    fetchMock.mockResolvedValueOnce(response(true)).mockRejectedValue(new Error("Offline"));
    const unread = jest.fn();
    stop = startInboxIndicatorPolling(unread); await flush();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(119_999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(unread).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValue(response(false));
    visibility.change("hidden"); visibility.change("visible"); await flush();
    expect(unread).toHaveBeenLastCalledWith(false);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("bounds a stalled request and never overlaps an active poll", async () => {
    fetchMock.mockImplementationOnce((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => reject(new Error("Aborted")));
    }));
    stop = startInboxIndicatorPolling(jest.fn());
    visibility.change("visible");
    await jest.advanceTimersByTimeAsync(14_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect((fetchMock.mock.calls[0][1].signal as AbortSignal).aborted).toBe(true);
    await jest.advanceTimersByTimeAsync(105_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
