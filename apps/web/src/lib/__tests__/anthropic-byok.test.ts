import { ANTHROPIC_BYOK_MODEL, callAIWithModel, getFollowUpRecommendation } from "../ai";
import { mockWeatherData } from "../../__tests__/mocks";
describe("Anthropic BYOK routing", () => {
  beforeEach(() => { (fetch as jest.Mock).mockReset(); });
  it("uses Messages with the user key even if a hosted default is selected", async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ content: [{ type: "text", text: '{"outfit":"Shirt","reasoning":"Comfort"}' }] }) });
    const result = await callAIWithModel("Style", "Clothes", "user-secret", false, "gpt-4o", "anthropic", 600);
    expect(result.modelUsed).toBe(ANTHROPIC_BYOK_MODEL);
    const [url, options] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages"); expect(options.headers["x-api-key"]).toBe("user-secret");
    const body = JSON.parse(options.body); expect(body.model).toBe(ANTHROPIC_BYOK_MODEL); expect(body.max_tokens).toBe(600);
  });
  it("retains the provider for follow-ups", async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ content: [{ type: "text", text: '{"outfit":"Jacket","reasoning":"Warmer"}' }] }) });
    const result = await getFollowUpRecommendation({ previousOutfit: "Shirt", previousReasoning: "Warm", weather: mockWeatherData,
      followUpMessage: "Warmer", unitPreference: "metric", userApiKey: "user-secret", byokProvider: "anthropic" });
    expect(result.modelUsed).toBe(ANTHROPIC_BYOK_MODEL);
  });
  it("does not expose provider bodies/credentials on failure or silently fall back", async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: "user-secret" }) });
    await expect(callAIWithModel("Style", "Clothes", "user-secret", false, undefined, "anthropic", 600)).rejects.toThrow("HTTP 401");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects truncated responses", async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ stop_reason: "max_tokens", content: [{ type: "text", text: "{" }] }) });
    await expect(callAIWithModel("Style", "Clothes", "user-secret", false, undefined, "anthropic", 600)).rejects.toThrow("incomplete");
  });
});
