import type { NextRequest } from "next/server";
import { POST } from "../outfits/swap/route";
import { callAIWithModel } from "@/lib/ai";
import { newWardrobeItem } from "@/lib/wardrobe";

jest.mock("@/auth", () => ({ auth: jest.fn().mockResolvedValue({ user: { id: "fixture-user" } }), DEMO_USER_ID: "demo" }));
jest.mock("@/lib/ai", () => ({ ...jest.requireActual("@/lib/ai-models"), callAIWithModel: jest.fn() }));
jest.mock("@/lib/accounting", () => ({ getActiveAccounting: jest.fn().mockResolvedValue(null) }));
jest.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: jest.fn(() => ({
  select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: { is_dev: true, pending_deletion: false }, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
})) } }));
jest.mock("@/lib/wardrobe-server", () => ({ readWardrobe: jest.fn() }));
import { readWardrobe } from "@/lib/wardrobe-server";

const current = { ...newWardrobeItem("11111111-1111-4111-8111-111111111111", "Shirt"), category: "top" as const };
const replacement = { ...current, id: "22222222-2222-4222-8222-222222222222", label: "Warm shirt" };
const payload = { outfit: "Shirt", reasoning: "Suitable for the weather", slots: [{ id: "top", category: "top", label: current.label, itemId: current.id }], gaps: [], bring: [], changes: [] };
const originalEnv = process.env;
function request(extra = {}) {
  return { json: jest.fn().mockResolvedValue({ payload, slotId: "top", ...extra }), headers: new Headers() } as unknown as NextRequest;
}

describe("AI swap provider availability", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    jest.clearAllMocks();
    (readWardrobe as jest.Mock).mockResolvedValue({ items: [current.label, replacement.label], wardrobeItems: [current, replacement], revision: 1 });
    (callAIWithModel as jest.Mock).mockResolvedValue({ raw: JSON.stringify({ itemId: replacement.id }) });
  });
  afterEach(() => { process.env = originalEnv; });

  it("uses configured Gemini for a Dev swap when OpenAI is absent", async () => {
    process.env.GEMINI_API_KEY = "synthetic-hosted-key";
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ payload: { slots: [{ itemId: replacement.id }] } });
    expect(callAIWithModel).toHaveBeenCalledWith(expect.any(String), expect.any(String), undefined, true, "gemini-2.5-flash", undefined, 200);
  });

  it("keeps BYOK usable without any hosted provider credentials", async () => {
    const response = await POST(request({ userApiKey: "synthetic-user-key", byokProvider: "mistral" }));
    expect(response.status).toBe(200);
    expect(callAIWithModel).toHaveBeenCalledWith(expect.any(String), expect.any(String), "synthetic-user-key", true, "gpt-4o", "mistral", 200);
  });

  it("fails recoverably without calling a provider when none is configured", async () => {
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("original outfit is preserved") });
    expect(callAIWithModel).not.toHaveBeenCalled();
  });
});
