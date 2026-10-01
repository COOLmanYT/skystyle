import { NextRequest } from "next/server";
import { GET as inbox, PATCH as editInbox } from "../inbox/route";
import { GET as closet, POST as addItem, DELETE as deleteItem, PATCH as replaceItems } from "../closet/route";
import { GET as settings } from "../settings/route";
import { syncPublicUser } from "@/lib/sync-user";
import { supabaseAdmin } from "@/lib/supabase";
jest.mock("@/auth", () => ({ auth: jest.fn().mockResolvedValue({ user: { id: "demo-user-123" } }), DEMO_USER_ID: "demo-user-123" }));
jest.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock("@/lib/sync-user", () => ({ syncPublicUser: jest.fn() }));
describe("Preview-only cloud data", () => {
  it("returns explicit empty reads without creating a demo account", async () => {
    expect(await (await inbox()).json()).toMatchObject({ messages: [], preferences: null });
    expect(await (await closet()).json()).toMatchObject({ items: [] });
    expect(await (await settings()).json()).toEqual({});
    expect(supabaseAdmin.from).not.toHaveBeenCalled(); expect(syncPublicUser).not.toHaveBeenCalled();
  });
  it("refuses demo writes before reading a body or syncing UUID data", async () => {
    const request = {} as NextRequest;
    for (const action of [editInbox, addItem, deleteItem, replaceItems]) expect((await action(request)).status).toBe(403);
    expect(supabaseAdmin.from).not.toHaveBeenCalled(); expect(syncPublicUser).not.toHaveBeenCalled();
  });
});
