import { supabaseAdmin } from "./supabase";
export async function getSchedulerHealth() {
  try {
  const result=await supabaseAdmin.rpc("v63_scheduler_health");
  if(result.error || !result.data) return {status:"unavailable" as const};
  const counts=result.data as {overdue:number;stuck:number;pendingDelivery:number;httpFailures:number;unanswered:number};
  return {...counts,status:counts.overdue||counts.stuck||counts.pendingDelivery||counts.httpFailures||counts.unanswered?"attention" as const:"ok" as const};
  } catch { return {status:"unavailable" as const}; }
}
