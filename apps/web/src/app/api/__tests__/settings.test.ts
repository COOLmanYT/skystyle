import { NextRequest } from "next/server";
import { PATCH } from "../settings/route";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";

jest.mock("@/auth", () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: "demo-user-123" } }),
  DEMO_USER_ID: "demo-user-123",
}));

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: jest.fn() },
}));

jest.mock("@/lib/daily-usage", () => ({
  canUseFeature: jest.fn(),
  incrementUsage: jest.fn(),
}));

jest.mock("@/lib/sync-user", () => ({
  syncPublicUser: jest.fn(),
}));

function request(body: unknown): NextRequest {
  return { json: jest.fn().mockResolvedValue(body) } as unknown as NextRequest;
}

describe("Settings API V6 onboarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (jest.requireMock("@/auth").auth as jest.Mock).mockResolvedValue({ user: { id: "demo-user-123" } });
  });

  it("keeps onboarding-only demo completion in the browser", async () => {
    const response = await PATCH(request({
      onboarding: { complete: true, experienceMode: "guided" },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      persistence: "browser",
      updated: { experience_mode: "guided" },
    });
    expect(jest.mocked(syncPublicUser)).not.toHaveBeenCalled();
    expect(jest.mocked(supabaseAdmin.from)).not.toHaveBeenCalled();
  });

  it("rejects an invalid onboarding experience mode", async () => {
    const response = await PATCH(request({ onboarding: { experienceMode: "expert" } }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid onboarding experience mode" });
  });

  it("persists completion and the selected mode for a real account", async () => {
    const userId = "29198832-9a2e-476e-95c6-8c9a80538144";
    (jest.requireMock("@/auth").auth as jest.Mock).mockResolvedValue({ user: { id: userId } });
    const upsert = jest.fn().mockResolvedValue({ error: null });
    jest.mocked(supabaseAdmin.from).mockImplementation((table) => {
      if (table === "users") {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { is_pro: false, is_dev: false } }) }) }) } as never;
      }
      if (table === "settings") return { upsert } as never;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await PATCH(request({ onboarding: { complete: true, experienceMode: "advanced" } }));

    expect(response.status).toBe(200);
    expect(syncPublicUser).toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: userId,
        experience_mode: "advanced",
        onboarding_completed_at: expect.any(String),
      }),
      { onConflict: "user_id" },
    );
  });
});
