import { GET, PUT, PATCH, DELETE } from "../style-feedback/route";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";

jest.mock("@/auth", () => ({ auth: jest.fn(), DEMO_USER_ID: "demo" }));
jest.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock("@/lib/sync-user", () => ({ syncPublicUser: jest.fn() }));

const request = (body: unknown) => ({ json: async () => body }) as Request;
const feedback = { entries: [{ id: "vote-1", vote: "down", note: "Keep it brief", createdAt: "2026-09-28T00:00:00Z" }], summary: "User prefers brief advice" };

describe("V6 private cloud feedback API", () => {
  const settingsRead = jest.fn();
  const feedbackRead = jest.fn();
  const upsert = jest.fn();
  const update = jest.fn();
  const saveResult = jest.fn();
  const writeEq = jest.fn();
  const deleteEq = jest.fn();
  const readEq = jest.fn();
  const select = jest.fn();
  beforeEach(() => {
    jest.mocked(auth).mockResolvedValue({ user: { id: "owner" } } as never);
    settingsRead.mockResolvedValue({ data: { feedback_storage_mode: "local" }, error: null });
    feedbackRead.mockResolvedValue({ data: feedback, error: null });
    upsert.mockResolvedValue({ error: null });
    saveResult.mockResolvedValue({ data: { updated_at: "2026-09-28T00:00:00Z" }, error: null });
    const writer = { select: () => ({ maybeSingle: saveResult }), eq: writeEq };
    writeEq.mockReturnValue(writer);
    update.mockReturnValue(writer);
    deleteEq.mockResolvedValue({ error: null });
    jest.mocked(supabaseAdmin.from).mockImplementation((table) => ({
      select: (fields: string) => { select(table, fields); return { eq: (field: string, value: string) => {
        readEq(field, value);
        return { maybeSingle: table === "settings" ? settingsRead : feedbackRead };
      } }; },
      upsert: table === "style_feedback_preferences" ? (...args: unknown[]) => { upsert(...args); return writer; } : upsert,
      update,
      delete: () => ({ eq: deleteEq }),
    }) as never);
  });

  it("requires authentication for every operation", async () => {
    jest.mocked(auth).mockResolvedValue(null as never);
    expect((await GET()).status).toBe(401);
    expect((await PUT(request(feedback))).status).toBe(401);
    expect((await PATCH(request({ storageMode: "local" }))).status).toBe(401);
    expect((await DELETE()).status).toBe(401);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it("defaults to local without fetching any cloud feedback", async () => {
    const response = await GET();
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({ storageMode: "local", entries: [], summary: "" });
    expect(select).not.toHaveBeenCalledWith("style_feedback_preferences", "entries, summary, updated_at");
  });

  it("loads cloud feedback only for the session owner", async () => {
    settingsRead.mockResolvedValue({ data: { feedback_storage_mode: "cloud" }, error: null });
    expect(await (await GET()).json()).toMatchObject({ storageMode: "cloud", ...feedback });
    expect(readEq).toHaveBeenCalledWith("user_id", "owner");
  });

  it("ignores forged ownership and saves only validated fields", async () => {
    expect((await PUT(request({ ...feedback, user_id: "victim" }))).status).toBe(200);
    expect(upsert).toHaveBeenNthCalledWith(1, { user_id: "owner", ...feedback, updated_at: expect.any(String) }, { onConflict: "user_id", ignoreDuplicates: true });
    expect(upsert).toHaveBeenNthCalledWith(2, { user_id: "owner", feedback_storage_mode: "cloud" }, { onConflict: "user_id" });
  });

  it("does not enable cloud storage when the data save fails", async () => {
    saveResult.mockResolvedValue({ data: null, error: { message: "Database offline" } });
    expect((await PUT(request(feedback))).status).toBe(503);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("uses an atomic version check when editing existing cloud feedback", async () => {
    expect((await PUT(request({ ...feedback, expectedUpdatedAt: "2026-09-28T00:00:00Z" }))).status).toBe(200);
    expect(writeEq).toHaveBeenCalledWith("user_id", "owner");
    expect(writeEq).toHaveBeenCalledWith("updated_at", "2026-09-28T00:00:00Z");
  });

  it("rejects a stale device save instead of overwriting newer feedback", async () => {
    saveResult.mockResolvedValue({ data: null, error: null });
    expect((await PUT(request({ ...feedback, expectedUpdatedAt: "2026-09-28T00:00:00Z" }))).status).toBe(409);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects malformed data without changing storage", async () => {
    expect((await PUT(request({ entries: [{ ...feedback.entries[0], vote: "invalid" }], summary: "" }))).status).toBe(400);
    expect((await PUT(request({ entries: [], summary: "x".repeat(601) }))).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("moves to local and removes only the owner cloud copy", async () => {
    expect((await PATCH(request({ storageMode: "local", user_id: "victim" }))).status).toBe(200);
    expect(upsert).toHaveBeenCalledWith({ user_id: "owner", feedback_storage_mode: "local" }, { onConflict: "user_id" });
    expect(deleteEq).toHaveBeenCalledWith("user_id", "owner");
  });

  it("does not delete data when changing settings fails", async () => {
    upsert.mockResolvedValue({ error: { message: "Offline" } });
    expect((await PATCH(request({ storageMode: "local" }))).status).toBe(503);
    expect(deleteEq).not.toHaveBeenCalled();
  });

  it("reports deletion failure rather than claiming success", async () => {
    deleteEq.mockResolvedValue({ error: { message: "Offline" } });
    expect((await DELETE()).status).toBe(503);
    expect(deleteEq).toHaveBeenCalledWith("user_id", "owner");
  });

  it("does not persist demo feedback", async () => {
    jest.mocked(auth).mockResolvedValue({ user: { id: "demo" } } as never);
    expect(await (await GET()).json()).toMatchObject({ storageMode: "local", cloudAvailable: false });
    expect((await PUT(request(feedback))).status).toBe(409);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });
});
