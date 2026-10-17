import { nextRunAt, runAutomaticRecommendationSchedule, claimAndRunAutomaticRecommendations, type AutomaticRecommendationSchedule } from "../automated-recommendations";
import { getStyleRecommendation } from "../ai";
import { getWeather } from "../weather";
import { canUseFeature, incrementUsage } from "../daily-usage";
import { deductCredit } from "../credits";
import { mockWeatherData } from "../../__tests__/mocks";
import { supabaseAdmin } from "../supabase";
jest.unmock("../entitlements");
const writes: { table: string; action: string; value: Record<string, unknown> }[] = [];
let blocked = false, pro = false, inboxFails = false, databaseFails = false, active = false;
function mockQuery(table: string) {
  const read = table === "users" ? { is_pro: pro, is_dev: false, pending_deletion:false } : table === "v6_entitlement_rollout" ? {enabled:active,checkout_enabled:false} : table === "user_access_controls" ? { app_blocked: blocked } : table === "automated_recommendation_runs" ? { id: "run" } : {};
  const result = { data: read, error: table === "user_inbox" && inboxFails || databaseFails ? { message: "private-db-error" } : null };
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result), single: jest.fn().mockResolvedValue(result),
    insert: jest.fn(), update: jest.fn(),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve) };
  query.insert.mockImplementation((value) => { writes.push({ table, action: "insert", value }); return query; });
  query.update.mockImplementation((value) => { writes.push({ table, action: "update", value }); return query; });
  return query;
}
jest.mock("../supabase", () => ({ supabaseAdmin: { from: (table: string) => mockQuery(table), rpc: jest.fn().mockResolvedValue({ data: [], error: null }) } }));
jest.mock("../weather", () => ({ getWeather: jest.fn() }));
jest.mock("../ai", () => ({ getStyleRecommendation: jest.fn(), getDefaultModel: (isPro: boolean) => ({ id: isPro ? "gpt-4o" : "gemini-2.5-flash" }) }));
jest.mock("../daily-usage", () => ({ canUseFeature: jest.fn(), incrementUsage: jest.fn() }));
jest.mock("../credits", () => ({ getCredits: jest.fn().mockResolvedValue(10), deductCredit: jest.fn().mockResolvedValue(9) }));
jest.mock("../accounting",()=>({ ...jest.requireActual("../accounting"),getActiveAccounting:jest.fn(async()=>active?{plan:"free",isDev:false}:null) }));
const schedule: AutomaticRecommendationSchedule = { id: "schedule", user_id: "owner", label: "Morning", latitude: -33.87, longitude: 151.21,
  unit_preference: "metric", prompt: "Brief please", recurrence: "daily", time_zone: "Australia/Sydney", next_run_at: "2026-10-03T22:00:00Z" };
describe("Automatic recommendations", () => {
  beforeEach(() => { blocked = pro = inboxFails = databaseFails = active = false; writes.length = 0;
    (supabaseAdmin.rpc as jest.Mock).mockResolvedValue({data:[],error:null});
    (getWeather as jest.Mock).mockResolvedValue(mockWeatherData); (canUseFeature as jest.Mock).mockResolvedValue({ allowed: true }); (incrementUsage as jest.Mock).mockResolvedValue(true);
    (getStyleRecommendation as jest.Mock).mockResolvedValue({ outfit: "Shirt", reasoning: "Comfort" }); });
  it("retains the selected local time over spring/fall DST and weekly boundaries", () => {
    expect(nextRunAt({ ...schedule, next_run_at: "2026-10-03T00:00:00Z" })).toBe("2026-10-03T23:00:00.000Z");
    expect(nextRunAt({ ...schedule, next_run_at: "2026-04-04T23:00:00Z" })).toBe("2026-04-05T23:00:00.000Z");
    expect(nextRunAt({ ...schedule, recurrence: "weekly", time_zone: "UTC", next_run_at: "2026-09-28T10:00:00Z" })).toBe("2026-10-05T10:00:00.000Z");
  });
  it("enforces blocked accounts and daily limits before provider calls", async () => {
    blocked = true; expect((await runAutomaticRecommendationSchedule(schedule)).status).toBe("failed"); expect(getWeather).not.toHaveBeenCalled();
    blocked = false; (canUseFeature as jest.Mock).mockResolvedValue({ allowed: false });
    await runAutomaticRecommendationSchedule(schedule); expect(getStyleRecommendation).not.toHaveBeenCalled();
  });
  it("skips missed daily and weekly occurrences without changing the local time", () => {
    expect(nextRunAt({ ...schedule, next_run_at: "2026-10-01T00:00:00Z" }, new Date("2026-10-07T01:00:00Z"))).toBe("2026-10-07T23:00:00.000Z");
    expect(nextRunAt({ ...schedule, recurrence: "weekly", time_zone: "UTC", next_run_at: "2026-09-01T10:00:00Z" }, new Date("2026-09-28T12:00:00Z"))).toBe("2026-09-29T10:00:00.000Z");
  });
  it("does not claim success when usage consumption fails", async () => {
    (incrementUsage as jest.Mock).mockResolvedValue(false);
    expect((await runAutomaticRecommendationSchedule(schedule)).status).toBe("failed");
    expect(writes.some((write) => write.value.status === "completed")).toBe(false);
  });
  it("uses the Free default, consumes current usage, and saves the completed result", async () => {
    expect(await runAutomaticRecommendationSchedule(schedule)).toEqual({ status: "completed" });
    expect(getStyleRecommendation).toHaveBeenCalledWith(expect.objectContaining({ modelId: "gemini-2.5-flash", customSystemPrompt: undefined, clientCustomPrompt: undefined }));
    expect(incrementUsage).toHaveBeenCalledWith("owner", "ai_uses", false, false);
    expect(writes.some((write) => write.value.status === "completed")).toBe(true);
  });
  it("uses the Pro default and existing App Credits", async () => {
    pro = true; await runAutomaticRecommendationSchedule(schedule);
    expect(getStyleRecommendation).toHaveBeenCalledWith(expect.objectContaining({ modelId: "gpt-4o", clientCustomPrompt: "Brief please" }));
    expect(deductCredit).toHaveBeenCalledWith("owner");
  });
  it("keeps completed run history if the Inbox copy fails", async () => {
    inboxFails = true; expect(await runAutomaticRecommendationSchedule(schedule)).toEqual({ status: "completed" });
    expect(writes.some((write) => write.value.status === "failed")).toBe(false);
  });
  it("sanitizes failures, advances recurrence and disables failed one-offs", async () => {
    (getWeather as jest.Mock).mockRejectedValue(new Error("secret-provider-url"));
    const result = await runAutomaticRecommendationSchedule({ ...schedule, recurrence: "once" });
    expect(result.error).not.toContain("secret-provider-url");
    expect(writes).toContainEqual(expect.objectContaining({ table: "automated_recommendation_schedules", value: expect.objectContaining({ active: false, locked_at: null }) }));
    expect(incrementUsage).not.toHaveBeenCalled();
  });
  it("claims one job by default, within the bounded runner budget", async () => {
    await claimAndRunAutomaticRecommendations();
    expect(jest.requireMock("../supabase").supabaseAdmin.rpc).toHaveBeenCalledWith("claim_due_automated_recommendation_schedules", { max_jobs: 1 });
  });
  describe("active shared accounting",()=>{
    const activeSchedule={...schedule,id:"33333333-3333-4333-8333-333333333333",user_id:"11111111-1111-4111-8111-111111111111"};
    beforeEach(()=>{
      active=true;pro=true; // Legacy Pro must not override the dated Free plan.
      (supabaseAdmin.rpc as jest.Mock).mockImplementation(async(name:string,args:Record<string,unknown>)=>({data:name === "v6_reserve_usage"?{created:true,status:"reserved",requestId:args.p_request_id,billingMode:"included",reservedCredits:0,leaseEndsAt:"2099-01-01T00:10:00Z"}:{status:args.p_success?"committed":"released",requestId:args.p_request_id,credits:0},error:null}));
    });
    it("shares included recommendation caps and uses the effective model without legacy charges",async()=>{
      expect(await runAutomaticRecommendationSchedule(activeSchedule)).toEqual({status:"completed"});
      expect(getStyleRecommendation).toHaveBeenCalledWith(expect.objectContaining({modelId:"gemini-2.5-flash",clientCustomPrompt:undefined}));
      expect(supabaseAdmin.rpc).toHaveBeenCalledWith("v6_reserve_usage",expect.objectContaining({p_user_id:activeSchedule.user_id,p_purpose:"recommendation",p_use_credits:false}));
      expect(incrementUsage).not.toHaveBeenCalled();expect(deductCredit).not.toHaveBeenCalled();
    });
    it("does not generate after a monthly-cap rejection",async()=>{
      (supabaseAdmin.rpc as jest.Mock).mockResolvedValue({data:null,error:{message:"monthly_usage_limit"}});
      expect((await runAutomaticRecommendationSchedule(activeSchedule)).status).toBe("failed");expect(getWeather).not.toHaveBeenCalled();expect(getStyleRecommendation).not.toHaveBeenCalled();
    });
    it("releases provider failures without publishing completed history",async()=>{
      (getStyleRecommendation as jest.Mock).mockRejectedValue(new Error("private-provider-message"));
      expect((await runAutomaticRecommendationSchedule(activeSchedule)).status).toBe("failed");
      expect(supabaseAdmin.rpc).toHaveBeenLastCalledWith("v6_settle_usage",expect.objectContaining({p_success:false,p_credit_charge:0}));
      expect(writes.some(write=>write.value.status === "completed")).toBe(false);
    });
    it("never publishes output when settlement is uncertain",async()=>{
      const normal=(supabaseAdmin.rpc as jest.Mock).getMockImplementation()!;
      (supabaseAdmin.rpc as jest.Mock).mockImplementation((name:string,args:Record<string,unknown>)=>name === "v6_settle_usage"?Promise.resolve({data:null,error:{message:"private DB error"}}):normal(name,args));
      expect((await runAutomaticRecommendationSchedule(activeSchedule)).status).toBe("failed");expect(writes.some(write=>write.value.status === "completed")).toBe(false);
    });
  });
});
