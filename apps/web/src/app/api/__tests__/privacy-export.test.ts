import { NextRequest } from "next/server";
import { GET } from "../privacy/export/route";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("next/server", () => ({ NextResponse: Response }));
jest.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock("@/lib/sync-user", () => ({ syncPublicUser: jest.fn() }));
jest.mock("@/lib/security", () => ({ logSecurityEvent: jest.fn() }));

describe("V6 feedback privacy export", () => {
  const eq = jest.fn();
  let feedbackError: unknown = null;
  const request = { headers: { get: () => null } } as unknown as NextRequest;
  beforeEach(() => {
    feedbackError = null;
    jest.mocked(auth).mockResolvedValue({ user: { id: "owner" } } as never);
    jest.mocked(supabaseAdmin.from).mockImplementation((table) => {
      const result = { data: table === "style_feedback_preferences" ? { entries: [], summary: "Brief advice", updated_at: "2026-09-28T00:00:00Z" } : {}, error: table === "style_feedback_preferences" ? feedbackError : null };
      const query = { select: () => query, eq: (field: string, id: string) => { eq(table, field, id); return query; },
        order: () => query, limit: () => query, single: async () => result, maybeSingle: async () => result,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
      return query as never;
    });
  });
  it("includes only the owner's cloud preferences and explains local data", async () => {
    const response = await GET(request);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.private_style_feedback.summary).toBe("Brief advice");
    expect(result.local_style_feedback_note).toContain("Device-only feedback is not held on the server");
    expect(eq).toHaveBeenCalledWith("style_feedback_preferences", "user_id", "owner");
  });
  it("does not claim a complete export when cloud feedback cannot be read", async () => {
    feedbackError = { message: "Offline" };
    expect((await GET(request)).status).toBe(503);
  });
  it("requires authentication before querying any personal data", async () => {
    jest.mocked(auth).mockResolvedValue(null as never);
    expect((await GET(request)).status).toBe(401);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });
});
