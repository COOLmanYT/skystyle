import { supabaseAdmin } from "../supabase";
import { getAdminAccounting } from "../admin-accounting";
jest.unmock("../entitlements");
jest.mock("../supabase",()=>({supabaseAdmin:{from:jest.fn(),rpc:jest.fn()}}));
const user="11111111-1111-4111-8111-111111111111";
let enabled=true, fail=false;
let accounts:unknown[]=[], periods:unknown[]=[], lots:unknown[]=[];
beforeEach(()=>{
  enabled=true;fail=false;accounts=[];periods=[];lots=[];
  jest.useFakeTimers().setSystemTime(new Date("2026-10-01T00:00:00Z"));
  (supabaseAdmin.from as jest.Mock).mockImplementation((table:string)=>{
    const result={data:table === "v6_entitlement_rollout"?{enabled,checkout_enabled:false}:table === "v6_account_entitlements"?accounts:table === "v6_pro_periods"?periods:lots,error:fail?{message:"private DB error"}:null};
    const query:Record<string,unknown>={then:(resolve:(v:typeof result)=>unknown)=>Promise.resolve(result).then(resolve)};
    for (const method of ["select","eq","in","limit","order","range","gt","lte","or"]) query[method]=jest.fn(()=>query);
    query.single=jest.fn(async()=>result);return query;
  });
});
afterEach(()=>jest.useRealTimers());
describe("read-only admin accounting",()=>{
  it("never initializes an account or guesses its plan",async()=>{
    expect((await getAdminAccounting([user]))?.get(user)?.plan).toBe("uninitialized");expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });
  it("labels missing Pro dates instead of synthesizing a subscription",async()=>{
    accounts=[{user_id:user,plan:"pro"}];expect((await getAdminAccounting([user]))?.get(user)?.plan).toBe("period-required");
  });
  it.each([["2026-10-01T00:00:00Z","free"],["2026-10-02T00:00:00Z","pro"]])("treats the period end %s as exclusive",async(end,plan)=>{
    accounts=[{user_id:user,plan:"pro"}];periods=[{user_id:user,starts_at:"2026-09-01T00:00:00Z",ends_at:end,cancelled_at:null}];
    expect((await getAdminAccounting([user]))?.get(user)?.plan).toBe(plan);
  });
  it("separates grant/purchased/imported sources without granting or double-counting",async()=>{
    accounts=[{user_id:user,plan:"free"}];lots=[{user_id:user,kind:"signup",remaining:10},{user_id:user,kind:"purchased",remaining:4},{user_id:user,kind:"legacy_api",remaining:5}];
    expect((await getAdminAccounting([user]))?.get(user)?.credits).toEqual({total:19,grants:10,purchased:4,legacy:5});expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
    expect(supabaseAdmin.from).not.toHaveBeenCalledWith("api_keys");
  });
  it("does not return stale legacy data on a database error",async()=>{
    fail=true;await expect(getAdminAccounting([user])).rejects.toMatchObject({code:"accounting_unavailable"});
  });
  it("leaves inactive accounting on the legacy path",async()=>{
    enabled=false;expect(await getAdminAccounting([user])).toBeNull();expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
  });
});
