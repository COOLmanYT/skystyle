import { supabaseAdmin } from "@/lib/supabase";
import { getStyleRecommendation, StyleRecommendation } from "@/lib/ai";
import { getScheduledModel } from "@/lib/scheduled-model";
import { getWeather, WeatherData } from "@/lib/weather";
import { parseComfort } from "@/lib/comfort";
import { canUseFeature } from "@/lib/daily-usage";
import { getCredits } from "@/lib/credits";
import { getActiveAccounting, scheduledUsageId } from "@/lib/accounting";
import { EntitlementError, reserveV6Usage, settleV6Usage, type UsageReservation } from "@/lib/entitlements";

export type AutomaticRecurrence = "once" | "daily" | "weekly";

export interface AutomaticRecommendationSchedule {
  id: string;
  user_id: string;
  label: string;
  latitude: number;
  longitude: number;
  unit_preference: "metric" | "imperial";
  prompt: string | null;
  recurrence: AutomaticRecurrence;
  time_zone: string;
  next_run_at: string;
}

export function nextRunAt(schedule: AutomaticRecommendationSchedule, after?: Date): string {
  if (schedule.recurrence === "once") return new Date().toISOString();
  // Advance the calendar day in the user's chosen zone, not a fixed 24-hour
  // duration, so a daily schedule remains at its chosen wall-clock time across DST.
  const date = new Date(schedule.next_run_at);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: schedule.time_zone || "UTC", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const interval = schedule.recurrence === "weekly" ? 7 : 1;
  let periods = 1;
  if (after) {
    const nowParts = Object.fromEntries(formatter.formatToParts(after).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    const wallClock = (value: Record<string, string>) => Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day), Number(value.hour), Number(value.minute), Number(value.second));
    // Skip missed occurrences rather than repeatedly charging for a backlog.
    periods = Math.max(1, Math.floor((wallClock(nowParts) - wallClock(parts)) / (interval * 86_400_000)) + 1);
  }
  const localCalendar = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + interval * periods, Number(parts.hour), Number(parts.minute), Number(parts.second)));
  const target = { year: localCalendar.getUTCFullYear(), month: localCalendar.getUTCMonth() + 1, day: localCalendar.getUTCDate(), hour: localCalendar.getUTCHours(), minute: localCalendar.getUTCMinutes(), second: localCalendar.getUTCSeconds() };
  let candidate = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute, target.second);
  // Two passes account for the offset changing at the DST boundary.
  for (let pass = 0; pass < 2; pass += 1) {
    const zoned = Object.fromEntries(formatter.formatToParts(new Date(candidate)).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    const renderedAsUtc = Date.UTC(Number(zoned.year), Number(zoned.month) - 1, Number(zoned.day), Number(zoned.hour), Number(zoned.minute), Number(zoned.second));
    candidate += Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute, target.second) - renderedAsUtc;
  }
  return new Date(candidate).toISOString();
}

interface DurableRun { id: string; lease_token: string; weather: WeatherData | null; recommendation: StyleRecommendation | null; usage_receipt: UsageReservation | null; legacy_plan: string | null }
async function runRpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin.rpc(name,args);
  if(error) throw new Error("Automatic recommendation storage unavailable.");
  return data;
}
export async function runAutomaticRecommendationSchedule(schedule: AutomaticRecommendationSchedule): Promise<{status:"completed"|"failed"|"recovering";error?:string}> {
  const occurrenceId=scheduledUsageId(schedule.id,schedule.next_run_at);
  const begun=await runRpc("v63_begin_auto_run",{p_schedule_id:schedule.id,p_occurrence_id:occurrenceId,p_occurrence_at:schedule.next_run_at});
  if(begun?.action==="busy" || begun?.action==="skip") return {status:"recovering"};
  if(!begun?.run?.id || !begun?.run?.lease_token) throw new Error("Automatic recommendation lease unavailable.");
  const run=begun.run as DurableRun;
  let receipt: UsageReservation | null=run.usage_receipt;
  let staged=Boolean(run.recommendation);
  let stagingAttempted=false;
  async function finish(success:boolean,error?:string) {
    const result=await runRpc("v63_finish_auto_run",{p_run_id:run.id,p_token:run.lease_token,p_next_run:nextRunAt(schedule,new Date()),p_success:success,p_error:error??null});
    try { await runRpc("v63_deliver_auto_run",{p_run_id:run.id}); } catch { /* Delivery retries independently; completed history stays available. */ }
    return {status:result.status as "completed"|"failed"};
  }
  try {
    if(begun.action==="finalize") return await finish(true);
    if(begun.action==="abandon") return await finish(false,"Automatic generation was interrupted. It was not repeated; create a new request to try again.");
    const [controls,settings,closet,profile,accounting]=await Promise.all([
      supabaseAdmin.from("user_access_controls").select("*").eq("user_id",schedule.user_id).maybeSingle(),
      supabaseAdmin.from("settings").select("*").eq("user_id",schedule.user_id).maybeSingle(),
      supabaseAdmin.from("closet").select("*").eq("user_id",schedule.user_id).maybeSingle(),
      supabaseAdmin.from("users").select("is_dev,is_pro,pending_deletion").eq("id",schedule.user_id).maybeSingle(),
      getActiveAccounting(schedule.user_id),
    ]);
    if([controls,settings,closet,profile].some(result=>result.error) || !profile.data || profile.data.pending_deletion || controls.data?.banned_at || controls.data?.app_blocked && (!controls.data.app_blocked_until || Date.parse(controls.data.app_blocked_until)>Date.now())) throw new Error("Account unavailable.");
    const isPro=accounting?accounting.plan==="pro":profile.data.is_pro===true;
    const isDev=accounting?accounting.isDev:profile.data.is_dev===true;
    const plan=isDev?"dev":accounting?.plan??(isPro?"pro":"free");
    if(!accounting&&!isDev){
      if(isPro&&await getCredits(schedule.user_id)<=0)throw new Error("Insufficient allowance.");
      if(!isPro&&!(await canUseFeature(schedule.user_id,"ai_uses",isPro,isDev)).allowed)throw new Error("Insufficient allowance.");
    }
    if(accounting)receipt=await reserveV6Usage({userId:schedule.user_id,purpose:"recommendation",requestId:occurrenceId,validatedInput:{scheduleId:schedule.id,occurrence:schedule.next_run_at}});
    // Record receipt before external work so interrupted workers can release it.
    const recorded=await supabaseAdmin.from("automated_recommendation_runs").update({usage_receipt:receipt,legacy_plan:plan}).eq("id",run.id).eq("lease_token",run.lease_token).eq("status","running").gt("lease_ends_at",new Date().toISOString()).select("id").single();
    if(recorded.error||!recorded.data)throw new Error("Unable to record automatic request.");
    const weather=await getWeather(schedule.latitude,schedule.longitude);
    const wardrobeItems=Array.isArray(closet.data?.wardrobe_items)?closet.data.wardrobe_items:[];
    const recommendation=await getStyleRecommendation({weather,closetItems:wardrobeItems.filter((item:{available:boolean})=>item.available).map((item:{label:string})=>item.label),wardrobeItems,structuredOutfit:true,
      unitPreference:schedule.unit_preference,customSystemPrompt:isPro||isDev?settings.data?.custom_system_prompt??undefined:undefined,
      clientCustomPrompt:isPro||isDev?schedule.prompt??undefined:undefined,recommendationContext:settings.data?.comfort_preferences?{comfort:parseComfort(settings.data.comfort_preferences)}:undefined,forceCloset:false,shareLocation:false,isDev,modelId:getScheduledModel(isPro,isDev).id});
    stagingAttempted=true;
    await runRpc("v63_stage_auto_result",{p_run_id:run.id,p_token:run.lease_token,p_weather:weather,p_recommendation:recommendation,p_receipt:receipt,p_legacy_plan:plan});
    staged=true;
    return await finish(true);
  } catch(error) {
    if(staged || stagingAttempted)return {status:"recovering"}; // Stored output is retried, never regenerated or charged twice.
    const message=error instanceof EntitlementError?error.message:"Automatic recommendation failed. No completed result was charged. Please try again.";
    if(receipt) { try { await settleV6Usage(receipt,false,0); } catch { return {status:"recovering"}; } }
    try { return {...await finish(false,message),error:message}; } catch { return {status:"recovering"}; }
  }
}

export async function claimAndRunAutomaticRecommendations(maxJobs = 1) {
  // Retry durable inbox copies first, independent of claiming new work.
  const pending = await supabaseAdmin.from("automated_recommendation_runs").select("id").eq("delivery_pending",true).limit(25);
  if(pending.error)throw new Error("Automatic delivery storage unavailable.");
  for(const run of pending.data??[]) { try { await runRpc("v63_deliver_auto_run",{p_run_id:run.id}); } catch { /* Report pending delivery through diagnostics. */ } }
  const { data, error } = await supabaseAdmin.rpc("claim_due_automated_recommendation_schedules", { max_jobs: maxJobs });
  if (error) throw error;
  const schedules = (data ?? []) as AutomaticRecommendationSchedule[];
  // Run sequentially. This avoids bursting external weather/AI providers and makes
  // an individual provider failure independent from the rest of the claimed jobs.
  const results = [] as Awaited<ReturnType<typeof runAutomaticRecommendationSchedule>>[];
  for (const schedule of schedules) {
    results.push(await runAutomaticRecommendationSchedule(schedule));
  }
  return {
    claimed: schedules.length,
    completed: results.filter((result) => result.status === "completed").length,
    recovering: results.filter(result=>result.status==="recovering").length,
    failed: results.filter((result) => result.status === "failed").length,
  };
}
