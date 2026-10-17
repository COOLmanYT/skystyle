/** Active-cutover integration: real accounting bridge, adapter and quota helpers,
 * synthetic DB/provider boundaries. No live identities, keys or provider calls. */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getV6AccountSnapshot } from "@/lib/entitlements";
import { getActiveAccounting, scheduledUsageId } from "@/lib/accounting";
import { V6_PLAN_RULES } from "@/lib/entitlement-policy";
import { getDefaultModel, getStyleRecommendation, getFollowUpRecommendation } from "@/lib/ai";
import { getWeather } from "@/lib/weather";
import { searchShop } from "@/lib/shop";
import { deductCredit, deductStoredAppCredit, getCredits, getMoneyCreditCents } from "@/lib/credits";
import { canUseFeature, incrementUsage, getDailyLimitsInfo } from "@/lib/daily-usage";
import { withApiAuth } from "@/lib/api-middleware";
import { POST as style } from "../style/route";
import { POST as followup } from "../followup/route";
import { POST as shop } from "../shop/route";
import { GET as wallet, PATCH as allocate } from "../credits/route";
import { POST as createKey, PATCH as updateKey } from "../api-keys/route";
import { PATCH as settings } from "../settings/route";
import { mockWeatherData, mockStyleRecommendation } from "../../../__tests__/mocks";

jest.mock("next/server", () => ({
  NextResponse: class extends Response { static json(data:unknown, init:ResponseInit={}) { return new this(JSON.stringify(data), { ...init, headers:{ ...Object.fromEntries(new Headers(init.headers)), "content-type":"application/json" } }); } },
  after: jest.fn(),
}));
jest.mock("@/auth", () => ({ auth:jest.fn(), DEMO_USER_ID:"demo" }));
jest.mock("@/lib/supabase", () => ({ supabaseAdmin:{ from:jest.fn(), rpc:jest.fn() } }));
jest.mock("@/lib/sync-user", () => ({ syncPublicUser:jest.fn() }));
jest.mock("@/lib/security", () => ({ logSecurityEvent:jest.fn() }));
jest.mock("@/lib/api-keys", () => ({ ...jest.requireActual("@/lib/api-keys"), verifyApiKey:()=>true, generateApiKey:()=>({key:"synthetic-key",preview:"sk_live_test"}),hashApiKey:()=>"synthetic-hash" }));
jest.mock("@/lib/entitlements", () => ({ ...jest.requireActual("@/lib/entitlements"), getV6AccountSnapshot:jest.fn() }));
jest.mock("@/lib/weather", () => ({ ...jest.requireActual("@/lib/weather"), getWeather:jest.fn() }));
jest.mock("@/lib/ai", () => ({ ...jest.requireActual("@/lib/ai"), getStyleRecommendation:jest.fn(),getFollowUpRecommendation:jest.fn() }));
jest.mock("@/lib/shop", () => ({ ...jest.requireActual("@/lib/shop"), searchShop:jest.fn() }));

const owner="11111111-1111-4111-8111-111111111111", key="33333333-3333-4333-8333-333333333333", requestId="22222222-2222-4222-8222-222222222222";
const events:string[]=[], writes:{table:string; method:string}[]=[];
const reserved=new Map<unknown,number>();
let enabled=true, flagFails=false, reserveError:string|null=null, settleFails=false, released=false, blockedDuringWork=false;
let account = snapshot();
function snapshot() { return { plan:"free" as "free"|"pro",isDev:false,rules:{...V6_PLAN_RULES.free},credits:{total:10,grants:10,purchased:0,legacy:0},
  recommendations:{daily:2,monthly:59},followups:{daily:2,monthly:119},modelSwitchesToday:0,checkoutEnabled:false,
  date:"2026-09-29",month:"2026-09-01",asOf:"2026-09-29T01:00:00Z",dailyResetAt:"2026-09-30T00:00:00Z",monthlyResetAt:"2026-10-01T00:00:00Z" }; }
function mockQuery(table:string) {
  const data = table === "v6_entitlement_rollout" ? { enabled,checkout_enabled:false }
    : table === "users" ? { id:owner,is_pro:true,is_dev:false,pending_deletion:false }
    : table === "api_keys" ? {id:key,user_id:owner,key_hash:"synthetic-hash",key_preview:"sk_live_test",credits_remaining:0}
    : table === "settings" ? { custom_system_prompt:"legacy Pro secret preferences" } : table === "user_access_controls" && blockedDuringWork ? {banned_at:"2026-10-01T00:00:00Z"} : null;
  const result={ data, error:table === "v6_entitlement_rollout" && flagFails ? {message:"private-db-message"} : null, count:0 };
  const query:Record<string,unknown>={ then:(resolve:(v:typeof result)=>unknown)=>Promise.resolve(result).then(resolve) };
  for (const method of ["select","eq","gte","lte","gt","order","limit","range","in"]) query[method]=jest.fn(()=>query);
  for (const method of ["insert","update","upsert"]) query[method]=jest.fn(()=>{ writes.push({table,method});return query; });
  query.single=query.maybeSingle=jest.fn(async()=>result);
  // Key verification retrieves an array, while creation returns an object.
  if (table === "api_keys") query.then=(resolve:(v:unknown)=>unknown)=>Promise.resolve({...result,data:[data]}).then(resolve);
  return query;
}
function request(body:unknown, endpoint="/api/style", method="POST") {
  const req=new Request(`http://localhost:3000${endpoint}`,{method,headers:{"Content-Type":"application/json","Idempotency-Key":requestId,"Authorization":"Bearer sk_live_synthetic"},...(method === "GET" ? {} : {body:JSON.stringify(body)})});
  // Undici parses in Node's realm outside Jest's VM. JSON.parse here mirrors
  // a same-realm NextRequest without weakening the adapter's plain-data check.
  return Object.assign(req,{nextUrl:new URL(req.url), json:async()=>JSON.parse(JSON.stringify(body))}) as unknown as NextRequest;
}
beforeEach(()=>{
  enabled=true;flagFails=false;reserveError=null;settleFails=released=blockedDuringWork=false;events.length=writes.length=0;account=snapshot();
  reserved.clear();
  (auth as jest.Mock).mockResolvedValue({user:{id:owner,email:"synthetic@example.invalid"}});
  (getV6AccountSnapshot as jest.Mock).mockImplementation(async()=>account);
  (supabaseAdmin.from as jest.Mock).mockImplementation(mockQuery);
  (supabaseAdmin.rpc as jest.Mock).mockImplementation(async(name:string,args:Record<string,unknown>)=>{
    events.push(name);
    if (name === "v6_reserve_usage") {
      const cost=args.p_purpose === "api_recweather"?3:args.p_purpose === "api_recommend"?2:args.p_purpose === "api_weather" || args.p_purpose === "api_closet"?1:args.p_use_credits?args.p_purpose === "followup"?1:2:0;
      reserved.set(args.p_request_id,cost);
      return reserveError ? {data:null,error:{message:reserveError}} : {data:{created:true,status:"reserved",requestId:args.p_request_id,billingMode:String(args.p_purpose).startsWith("api_") || args.p_use_credits ? "metered":"included",reservedCredits:cost,leaseEndsAt:"2099-01-01T00:10:00Z"},error:null};
    }
    if (name === "v6_settle_usage") return settleFails ? {data:null,error:{message:"private-db-message"}} : {data:{requestId:args.p_request_id,status:args.p_success && !released?"committed":"released",credits:args.p_success && !released ? args.p_credit_charge ?? reserved.get(args.p_request_id) ?? 0 : 0},error:null};
    return {data:name === "v6_revoke_api_key" ? {id:args.p_key_id,revoked:true} : args.p_key_id,error:null};
  });
  (getWeather as jest.Mock).mockResolvedValue(mockWeatherData);
  (getStyleRecommendation as jest.Mock).mockImplementation(async()=>{events.push("style-provider");return mockStyleRecommendation;});
  (getFollowUpRecommendation as jest.Mock).mockImplementation(async()=>{events.push("followup-provider");return mockStyleRecommendation;});
  (searchShop as jest.Mock).mockImplementation(async()=>{events.push("shop-provider");return {status:"ok",products:[{name:"synthetic shirt"}]};});
});
const cases=[
  ["Style",style,{lat:-37.8,lon:145},"style-provider","recommendation"],
  ["follow-ups",followup,{message:"Shorter please",previousOutfit:"Shirt",weather:mockWeatherData},"followup-provider","followup"],
  ["Shop",shop,{query:"shirt"},"shop-provider","recommendation"],
] as const;
describe.each(cases)("Active %s integration",(_name,handler,body,provider,purpose)=>{
  it("reserves first, settles before success and never writes legacy credits/counts",async()=>{
    const res=await handler(request(body));expect(await res.clone().json()).not.toHaveProperty("error");expect(res.status).toBe(200);
    expect(events).toEqual(["v6_reserve_usage",provider,"v6_settle_usage"]);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith("v6_reserve_usage",expect.objectContaining({p_user_id:owner,p_request_id:requestId,p_purpose:purpose,p_use_credits:false}));
    expect(writes).toEqual([]);
  });
  it.each(["daily_usage_limit","monthly_usage_limit","pro_period_required","insufficient_credits"])("does not run a provider after %s",async(error)=>{
    reserveError=error;expect((await handler(request(body))).status).toBeGreaterThanOrEqual(400);
    expect(events).toEqual(["v6_reserve_usage"]);expect(writes).toEqual([]);
  });
  it("does not expose generated output when settlement is uncertain or released",async()=>{
    settleFails=true;const res=await handler(request(body));expect(res.status).toBe(503);expect(await res.text()).not.toContain(mockStyleRecommendation.outfit);
    settleFails=false;released=true;expect((await handler(request(body))).status).toBe(409);
  });
  it("accepts explicitly selected credit funding without automatic fallback",async()=>{
    const res=await handler(request({...body,useCredits:true}));expect(res.status).toBe(200);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith("v6_reserve_usage",expect.objectContaining({p_use_credits:true}));
  });
  it("fails closed on rollout-read errors, not legacy fallback",async()=>{
    flagFails=true;expect((await handler(request(body))).status).toBe(503);expect(events).toEqual([]);expect(writes).toEqual([]);
  });
  it("uses effective dated access, not the legacy Pro boolean",async()=>{
    expect((await handler(request({...body,userApiKey:"synthetic-byok"}))).status).toBe(403);expect(events).toEqual([]);
  });
});
describe("Shared accounting helper/read integration",()=>{
  it("returns one shared wallet and separate source balances, without legacy money grants",async()=>{
    const res=await wallet();expect(await res.json()).toMatchObject({accountingActive:true,isPro:false,appCredits:10,apiCredits:10,accountCredits:account.credits,moneyCreditCents:0,checkoutEnabled:false});
    expect(await getCredits(owner)).toBe(10);expect(await getMoneyCreditCents(owner,true,false)).toBe(0);expect(writes).toEqual([]);
  });
  it("rejects legacy credit allocation and deductions while active",async()=>{
    expect((await allocate(request({keyId:key,moneyCreditCents:100}))).status).toBe(409);
    await expect(deductCredit(owner)).rejects.toMatchObject({code:"legacy_writer_disabled"});
    await expect(deductStoredAppCredit(owner)).rejects.toMatchObject({code:"legacy_writer_disabled"});
    await expect(incrementUsage(owner,"ai_uses",true)).rejects.toMatchObject({code:"legacy_writer_disabled"});expect(writes).toEqual([]);
  });
  it("monthly limits and reset timestamps survive JSON and quota checks",async()=>{
    account.recommendations.monthly=60;expect((await canUseFeature(owner,"ai_uses",true)).allowed).toBe(false);
    const limits=await getDailyLimitsInfo(owner,true);expect(limits.ai).toEqual({used:2,limit:5,monthlyUsed:60,monthlyLimit:60});
    expect(limits.dailyResetAt).toBe("2026-09-30T00:00:00Z");expect(limits.monthlyResetAt).toBe("2026-10-01T00:00:00Z");
  });
  it("keeps unlimited closet/source usage out of the legacy writer",async()=>{
    expect(await incrementUsage(owner,"source_picks",false)).toBe(true);expect(await incrementUsage(owner,"closet_uses",false)).toBe(true);expect(writes).toEqual([]);
  });
  it("persists only Free-eligible settings after a Pro period has ended",async()=>{
    expect((await settings(request({unit_preference:"metric",custom_system_prompt:"not allowed"}))).status).toBe(200);
    expect(writes).toEqual([{table:"settings",method:"upsert"}]);
  });
  it("skips all account tables for a demo and derives a stable occurrence ID",async()=>{
    expect(await getActiveAccounting("demo",true)).toBeNull();expect(supabaseAdmin.from).not.toHaveBeenCalled();
    expect(scheduledUsageId(key,"2026-09-29T00:00:00Z")).toBe(scheduledUsageId(key,"2026-09-29T10:00:00+10:00"));
    expect(scheduledUsageId(key,"2026-09-30T00:00:00Z")).not.toBe(scheduledUsageId(key,"2026-09-29T00:00:00Z"));
  });
  it("releases empty Shop data and failed providers",async()=>{
    (searchShop as jest.Mock).mockResolvedValue({status:"ok",products:[]});expect((await shop(request({query:"shirt"}))).status).toBe(200);
    expect(supabaseAdmin.rpc).toHaveBeenLastCalledWith("v6_settle_usage",expect.objectContaining({p_success:false}));
    (getStyleRecommendation as jest.Mock).mockRejectedValue(new Error("synthetic failure"));expect((await style(request({lat:-37.8,lon:145}))).status).toBe(502);
    expect(supabaseAdmin.rpc).toHaveBeenLastCalledWith("v6_settle_usage",expect.objectContaining({p_success:false,p_credit_charge:0}));
  });
  it("releases the reservation when access is blocked during provider work",async()=>{
    (getStyleRecommendation as jest.Mock).mockImplementation(async()=>{blockedDuringWork=true;return mockStyleRecommendation;});
    const res=await style(request({lat:-37.8,lon:145}));expect(res.status).toBe(403);expect(await res.text()).not.toContain(mockStyleRecommendation.outfit);
    expect(supabaseAdmin.rpc).toHaveBeenLastCalledWith("v6_settle_usage",expect.objectContaining({p_success:false,p_credit_charge:0}));
  });
  it("selects the account's dated Pro default and rejects unavailable Free models",async()=>{
    const proModel=getDefaultModel(true,false).id;
    expect((await style(request({lat:-37.8,lon:145,modelId:proModel}))).status).toBe(403);
    account.plan="pro";expect((await style(request({lat:-37.8,lon:145}))).status).toBe(200);
    expect(getStyleRecommendation).toHaveBeenCalledWith(expect.objectContaining({modelId:proModel}));
  });
  it("creates account-scoped keys through the RPC without per-key grants",async()=>{
    expect((await createKey(request({nickname:"Synthetic"}))).status).toBe(201);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith("v6_create_api_key",expect.objectContaining({p_user_id:owner,p_nickname:"Synthetic"}));expect(writes).toEqual([]);
  });
  it("revokes through the atomic RPC and never falls back to direct updates",async()=>{
    expect((await updateKey(request({id:key,action:"revoke"}))).status).toBe(200);expect(events).toEqual(["v6_revoke_api_key"]);expect(writes).toEqual([]);
    (supabaseAdmin.rpc as jest.Mock).mockResolvedValue({data:null,error:{message:"missing function"}});
    expect((await updateKey(request({id:key,action:"revoke"}))).status).toBe(503);expect(writes).toEqual([]);
  });
});
describe("Public API settlement-before-response",()=>{
  it.each([["/api/v1/recommend","api_recommend",2],["/api/v1/recweather","api_recweather",3],["/api/v1/weather","api_weather",1],["/api/v1/closet","api_closet",1]])("reserves %s using its endpoint purpose",async(endpoint,purpose,cost)=>{
    const handler=jest.fn(async()=>{events.push("api-provider");return NextResponse.json({outfit:"synthetic"});});
    expect((await withApiAuth(handler)(request({},endpoint))).status).toBe(200);
    expect(events).toEqual(["v6_reserve_usage","api-provider","v6_settle_usage"]);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith("v6_reserve_usage",expect.objectContaining({p_api_key_id:key,p_user_id:owner,p_purpose:purpose}));
    expect(supabaseAdmin.rpc).toHaveBeenLastCalledWith("v6_settle_usage",expect.objectContaining({p_success:true,p_credit_charge:cost}));expect(writes).toEqual([]);
  });
  it("partially charges recweather exactly two and releases full failures",async()=>{
    const partial=withApiAuth(async()=>NextResponse.json({error:"AI failed",weather:{}},{status:502,headers:{"x-api-partial-success":"true"}}));
    expect((await partial(request({},"/api/v1/recweather"))).status).toBe(502);
    expect(supabaseAdmin.rpc).toHaveBeenLastCalledWith("v6_settle_usage",expect.objectContaining({p_success:true,p_credit_charge:2}));
    const failure=withApiAuth(async()=>NextResponse.json({error:"No result"},{status:502}));await failure(request({},"/api/v1/recommend"));
    expect(supabaseAdmin.rpc).toHaveBeenLastCalledWith("v6_settle_usage",expect.objectContaining({p_success:false}));
  });
  it("does not return provider output on an uncertain API settlement",async()=>{
    settleFails=true;const res=await withApiAuth(async()=>NextResponse.json({outfit:"must-not-escape"}))(request({},"/api/v1/recommend"));
    expect(res.status).toBe(503);expect(await res.text()).not.toContain("must-not-escape");expect(writes).toEqual([]);
  });
  it("blocks provider work on depleted credits and invalid request IDs",async()=>{
    const handler=jest.fn();reserveError="insufficient_credits";
    expect((await withApiAuth(handler)(request({},"/api/v1/recommend"))).status).toBe(402);expect(handler).not.toHaveBeenCalled();
    const req=request({},"/api/v1/recommend");req.headers.set("Idempotency-Key","bad");expect((await withApiAuth(handler)(req)).status).toBe(400);expect(handler).not.toHaveBeenCalled();
  });
});
