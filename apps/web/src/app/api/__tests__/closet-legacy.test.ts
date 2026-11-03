import type { NextRequest } from "next/server";
import { POST, DELETE, PATCH } from "../closet/route";
import { readWardrobe } from "@/lib/wardrobe-server";
import { supabaseAdmin } from "@/lib/supabase";
import { newWardrobeItem } from "@/lib/wardrobe";
jest.mock("@/auth", () => ({ auth: jest.fn().mockResolvedValue({ user: { id: "fixture-user" } }), DEMO_USER_ID: "demo" }));
jest.mock("@/lib/sync-user", () => ({ syncPublicUser: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/wardrobe-server", () => ({ readWardrobe: jest.fn() }));
jest.mock("@/lib/supabase", () => ({ supabaseAdmin: { rpc: jest.fn() } }));
const first = { ...newWardrobeItem("11111111-1111-4111-8111-111111111111", "Shirt"), warmth: "warm" as const };
const second = { ...first, id: "22222222-2222-4222-8222-222222222222", warmth: "light" as const };
const snapshot = { wardrobeItems: [first, second], items: [first.label, second.label], revision: 3 };
const request = (body: unknown) => ({ json: jest.fn().mockResolvedValue(body) }) as unknown as NextRequest;
describe("description-only closet mutations preserve structured items", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (readWardrobe as jest.Mock).mockResolvedValue(snapshot);
    (supabaseAdmin.rpc as jest.Mock).mockResolvedValue({ data: snapshot, error: null });
  });
  it("adds a new item atomically without replacing duplicate descriptions", async () => {
    expect((await POST(request({ item: "Jacket" }))).status).toBe(200);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith("v63_mutate_wardrobe", expect.objectContaining({
      p_expected_revision: 3, p_operation: { type: "add", item: expect.objectContaining({ label: "Jacket", available: true, id: expect.any(String) }) },
    }));
  });
  it("keeps both IDs and attributes when an existing description is added", async () => {
    const response = await POST(request({ item: "shirt" }));
    expect(await response.json()).toEqual(snapshot);
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });
  it("deletes matching IDs without replacing unrelated clothes", async () => {
    expect((await DELETE(request({ item: "Shirt" }))).status).toBe(200);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith("v63_mutate_wardrobe", expect.objectContaining({ p_operation: { type: "delete", ids: [first.id, second.id] } }));
  });
  it("rejects ambiguous array replacement rather than collapsing stable IDs", async () => {
    const response = await PATCH(request({ items: ["Shirt"], revision: 3 }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ current: snapshot });
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });
  it("rejects an invalid replacement revision before reading the wardrobe", async () => {
    expect((await PATCH(request({ items: [], revision: -1 }))).status).toBe(428);
    expect(readWardrobe).not.toHaveBeenCalled();
  });
});
