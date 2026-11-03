import { NextRequest } from "next/server";
import { GET } from "../inbox/route";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";

jest.mock("@/auth", () => ({ auth: jest.fn(), DEMO_USER_ID: "demo-user-123" }));
jest.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock("@/lib/sync-user", () => ({ syncPublicUser: jest.fn() }));
jest.mock("next/server", () => ({ NextResponse: { json: (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), { ...init, headers: { ...init?.headers, "Content-Type": "application/json" } }) } }));
const request = () => ({ nextUrl: new URL("https://example.test/api/inbox?view=unread") }) as NextRequest;

describe("Private unread inbox summary", () => {
  const query = { select: jest.fn(), eq: jest.fn(), is: jest.fn(), limit: jest.fn() };
  beforeEach(() => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: "owner-id" } });
    (supabaseAdmin.from as jest.Mock).mockReturnValue(query);
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.is.mockReturnValue(query);
    query.limit.mockResolvedValue({ data: [{ id: "message-id" }], error: null });
  });
  it("rejects signed-out reads before accessing the database", async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });
  it("filters unread and undismissed rows by owner and returns only a private boolean", async () => {
    const result = await GET(request());
    expect(await result.json()).toEqual({ unread: true });
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
    expect(query.eq).toHaveBeenCalledWith("user_id", "owner-id");
    expect(query.is).toHaveBeenCalledWith("read_at", null);
    expect(query.is).toHaveBeenCalledWith("dismissed_at", null);
    expect(query.select).toHaveBeenCalledWith("id"); expect(query.limit).toHaveBeenCalledWith(1);
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
  });
  it("returns false for an empty inbox", async () => {
    query.limit.mockResolvedValue({ data: [], error: null });
    expect(await (await GET(request())).json()).toEqual({ unread: false });
  });
  it("fails closed on database errors rather than clearing an existing badge", async () => {
    query.limit.mockResolvedValue({ data: null, error: { message: "Unavailable" } });
    const result = await GET(request());
    expect(result.status).toBe(500);
    expect(await result.json()).not.toHaveProperty("unread");
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("keeps demo reads local without creating an account", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: "demo-user-123" } });
    expect(await (await GET(request())).json()).toEqual({ unread: false });
    expect(supabaseAdmin.from).not.toHaveBeenCalled(); expect(syncPublicUser).not.toHaveBeenCalled();
  });
});
