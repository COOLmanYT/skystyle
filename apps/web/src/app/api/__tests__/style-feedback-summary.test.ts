import { POST } from "../style-feedback/summary/route";
import { auth } from "@/auth";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@mistralai/mistralai", () => ({ Mistral: jest.fn(() => ({ chat: { complete: jest.fn() } })) }));

const request = (body: unknown) => ({ json: async () => body }) as Request;
const entries = [{ vote: "down", note: "Keep it brief", advice: "Wear a blue shirt" }];

describe("V6 Mistral feedback summary API", () => {
  let complete: jest.Mock;
  const oldKey = process.env.MISTRAL_API_KEY;
  let userCounter = 0;
  beforeEach(() => {
    process.env.MISTRAL_API_KEY = "test-only-key";
    jest.mocked(auth).mockResolvedValue({ user: { id: `owner-${userCounter++}` } } as never);
    complete = jest.fn().mockResolvedValue({ choices: [{ message: { content: '{"summary":"User prefers brief advice"}' } }] });
    jest.requireMock("@mistralai/mistralai").Mistral.mockImplementation(() => ({ chat: { complete } }));
  });
  afterAll(() => {
    if (oldKey === undefined) delete process.env.MISTRAL_API_KEY;
    else process.env.MISTRAL_API_KEY = oldKey;
  });

  it("requires authentication before third-party processing", async () => {
    jest.mocked(auth).mockResolvedValue(null as never);
    expect((await POST(request({ entries }))).status).toBe(401);
    expect(complete).not.toHaveBeenCalled();
  });
  it("rejects invalid feedback before third-party processing", async () => {
    expect((await POST(request({ entries: [{ vote: "other", note: "" }] }))).status).toBe(400);
    expect(complete).not.toHaveBeenCalled();
  });
  it("allows manual summaries when the provider is unconfigured", async () => {
    delete process.env.MISTRAL_API_KEY;
    expect((await POST(request({ entries }))).status).toBe(503);
    expect(complete).not.toHaveBeenCalled();
  });
  it("sends only bounded feedback data, not user identifiers or credentials", async () => {
    const response = await POST(request({ entries, apiKey: "do-not-send", user_id: "do-not-send" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ summary: "User prefers brief advice" });
    const call = complete.mock.calls[0][0];
    expect(call.model).toBe("mistral-small-latest");
    expect(call.messages[1].content).toBe(JSON.stringify(entries));
    expect(call.maxTokens).toBe(180);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("reports provider failure without inventing a preference", async () => {
    complete.mockRejectedValue(new Error("Provider unavailable"));
    expect((await POST(request({ entries }))).status).toBe(502);
  });
  it("rejects malformed model output", async () => {
    complete.mockResolvedValue({ choices: [{ message: { content: "bad JSON" } }] });
    expect((await POST(request({ entries }))).status).toBe(502);
  });
  it("limits provider attempts without charging app or API credits", async () => {
    for (let i = 0; i < 10; i++) expect((await POST(request({ entries }))).status).toBe(200);
    expect((await POST(request({ entries }))).status).toBe(429);
    expect(complete).toHaveBeenCalledTimes(10);
  });
});
