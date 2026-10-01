import type { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { GET } from "../app/api/cron/automatic-recommendations/route";
import { auth } from "@/auth";
import { claimAndRunAutomaticRecommendations } from "@/lib/automated-recommendations";
jest.mock("@/auth", () => ({ auth: jest.fn().mockResolvedValue(null) }));
jest.mock("@/lib/automated-recommendations", () => ({ claimAndRunAutomaticRecommendations: jest.fn() }));
jest.mock("next/server", () => ({ NextResponse: {
  next: () => new Response(null, { status: 200 }),
  redirect: (url: URL) => new Response(null, { status: 307, headers: { Location: String(url) } }),
  json: (data: unknown, init?: ResponseInit) => new Response(JSON.stringify(data), { status: init?.status ?? 200 }),
} }));
function request(path = "/api/cron/automatic-recommendations", authorization?: string) {
  const url = new URL(`https://example.test${path}`);
  return { nextUrl: { pathname: url.pathname, clone: () => new URL(url) }, headers: new Headers(authorization ? { authorization } : {}) } as unknown as NextRequest;
}
describe("Secret-authenticated scheduler routing", () => {
  beforeEach(() => { delete process.env.CRON_SECRET; (claimAndRunAutomaticRecommendations as jest.Mock).mockResolvedValue({ claimed: 1, completed: 1, failed: 0 }); });
  it("lets only the exact worker route reach secret authorization without interactive login", async () => {
    expect((await proxy(request())).status).toBe(200); expect(auth).not.toHaveBeenCalled();
    expect((await proxy(request("/api/cron/automatic-recommendations/extra"))).status).toBe(307);
    expect((await proxy(request("/dashboard"))).status).toBe(307);
  });
  it("fails closed for missing or incorrect worker secrets", async () => {
    expect((await GET(request())).status).toBe(401);
    process.env.CRON_SECRET = "test-cron-secret";
    expect((await GET(request(undefined, "Bearer wrong"))).status).toBe(401);
    expect(claimAndRunAutomaticRecommendations).not.toHaveBeenCalled();
  });
  it("claims jobs only after secret authorization and sanitizes failures", async () => {
    process.env.CRON_SECRET = "test-cron-secret";
    expect(await (await GET(request(undefined, "Bearer test-cron-secret"))).json()).toEqual({ claimed: 1, completed: 1, failed: 0 });
    (claimAndRunAutomaticRecommendations as jest.Mock).mockRejectedValue(new Error("private-provider-error"));
    const failure = await GET(request(undefined, "Bearer test-cron-secret"));
    expect(failure.status).toBe(500); expect(await failure.json()).toEqual({ error: "Automatic recommendation runner failed." });
  });
});
