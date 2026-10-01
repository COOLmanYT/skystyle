import { aggregateHealth, getCategoryHealth } from "../health-checks";
import { categoryHealthResponse } from "../health-response";
import { NextRequest } from "next/server";
jest.mock("../supabase", () => ({ supabaseAdmin: { from: jest.fn() } }));
describe("Bounded public health checks", () => {
  it("does not treat unconfigured providers as failures", () => {
    expect(aggregateHealth([{ provider: "a", status: "unconfigured", latencyMs: null }])).toBe("unconfigured");
    expect(aggregateHealth([{ provider: "a", status: "ok", latencyMs: 1 }, { provider: "b", status: "unconfigured", latencyMs: null }])).toBe("ok");
    expect(aggregateHealth([{ provider: "a", status: "degraded", latencyMs: 1 }])).toBe("degraded");
  });
  it("rejects unsupported filters before probing", async () => {
    const request = { nextUrl: { searchParams: new URLSearchParams("provider=../../secret") } } as NextRequest;
    const response = await categoryHealthResponse("ai", request);
    expect(response.status).toBe(400); expect(await response.json()).toMatchObject({ error: "invalid_provider" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("deduplicates concurrent refreshes, uses no generation endpoints, and serves cached results", async () => {
    let finish!: (value: unknown) => void;
    (fetch as jest.Mock).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const first = getCategoryHealth("weather"), second = getCategoryHealth("weather");
    expect(fetch).toHaveBeenCalledTimes(1);
    finish({ ok: true, body: { cancel: jest.fn() } });
    const [a, b] = await Promise.all([first, second]); expect(a.providers[0].status).toBe("ok"); expect(b.cached).toBe(true);
    expect((await getCategoryHealth("weather")).cached).toBe(true); expect(fetch).toHaveBeenCalledTimes(1);
    expect((fetch as jest.Mock).mock.calls[0][1].signal).toBeDefined();
  });
  it("sanitizes provider failures rather than exposing request URLs or keys", async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error("provider leaked secret-key"));
    const result = await getCategoryHealth("ai");
    expect(result.providers.every((provider) => provider.status === "degraded")).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/secret-key|test-openai-key|test-gemini-key/);
    expect((fetch as jest.Mock).mock.calls.every(([url]) => !String(url).includes("messages") && !String(url).includes("completions"))).toBe(true);
  });
});
