import { getScheduledModel } from "../scheduled-model";

describe("scheduled hosted model selection", () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.MISTRAL_API_KEY;
  });
  afterEach(() => { process.env = originalEnv; });

  it("uses Gemini for Dev when OpenAI is absent", () => {
    process.env.GEMINI_API_KEY = "synthetic";
    expect(getScheduledModel(false, true).provider).toBe("gemini");
  });
  it("uses Mistral when it is the only configured provider", () => {
    process.env.MISTRAL_API_KEY = "synthetic";
    expect(getScheduledModel(true, false).provider).toBe("mistral");
  });
  it("preserves Pro priority when OpenAI is configured", () => {
    process.env.OPENAI_API_KEY = "synthetic";
    process.env.GEMINI_API_KEY = "synthetic";
    expect(getScheduledModel(true, false).id).toBe("gpt-4o");
  });
  it("does not select Pro-only OpenAI for Free accounts", () => {
    process.env.OPENAI_API_KEY = "synthetic";
    process.env.MISTRAL_API_KEY = "synthetic";
    expect(getScheduledModel(false, false).provider).toBe("mistral");
  });
  it("rejects missing or whitespace-only credentials before generation", () => {
    process.env.GEMINI_API_KEY = "  ";
    expect(() => getScheduledModel(false, true)).toThrow("No hosted AI provider");
  });
});
