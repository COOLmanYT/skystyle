import { GET } from "../plans/route";
import { supabaseAdmin } from "@/lib/supabase";
jest.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: jest.fn() } }));
describe("public plan display metadata", () => {
  function result(data: unknown, error: unknown = null) {
    const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), abortSignal: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data, error }) };
    (supabaseAdmin.from as jest.Mock).mockReturnValue(query);
    return query;
  }
  it.each([false, true])("returns verified accounting state %s without enabling checkout", async enabled => {
    const query = result({ enabled });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ accountingEnabled: enabled, checkoutAvailable: false });
    expect(query.select).toHaveBeenCalledWith("enabled");
    expect(query.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
  it.each([null, {}, { enabled: "false" }])("does not guess allowances for malformed metadata %p", async data => {
    result(data);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ accountingEnabled: null, checkoutAvailable: false });
  });
  it("hides database diagnostics on read failure", async () => {
    result(null, { message: "sensitive service configuration" });
    const response = await GET();
    expect(await response.text()).not.toContain("sensitive");
  });
});
