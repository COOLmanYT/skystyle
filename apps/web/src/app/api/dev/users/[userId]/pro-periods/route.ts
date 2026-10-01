import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDevEmails } from "@/lib/dev-auth";
import { syncPublicUser } from "@/lib/sync-user";
import { supabaseAdmin } from "@/lib/supabase";
import { callEntitlementRpc, EntitlementError, getEntitlementRollout, isEntitlementUuid } from "@/lib/entitlements";
import { nextUtcMonth, parsePeriodTimestamp } from "@/lib/entitlement-policy";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ userId: string }> };

async function authorize(context: Context) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email || !getDevEmails().has(session.user.email.toLowerCase())) {
    throw new EntitlementError("admin_required", "Administrator access is required.", 403);
  }
  const { userId } = await context.params;
  if (!isEntitlementUuid(userId) || !isEntitlementUuid(session.user.id)) throw new EntitlementError("invalid_account", "Invalid account.", 400);
  await syncPublicUser(session);
  const { data, error } = await supabaseAdmin.from("users").select("is_dev, pending_deletion").eq("id", session.user.id).single();
  if (error || !data) throw new EntitlementError("accounting_unavailable", "Unable to verify administrator access.");
  if (data.is_dev !== true || data.pending_deletion !== false) throw new EntitlementError("admin_required", "Administrator access is required.", 403);
  return { actorId: session.user.id, userId };
}

function reply(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
function failure(error: unknown) {
  return error instanceof EntitlementError ? reply({ error: error.message, code: error.code }, error.status)
    : reply({ error: "Subscription period management is temporarily unavailable." }, 503);
}
async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  if (Number(req.headers.get("content-length")) > 4096) throw new EntitlementError("invalid_input", "Request is too large.", 413);
  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > 4096) throw new EntitlementError("invalid_input", "Request is too large.", 413);
  const body: unknown = JSON.parse(text);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new EntitlementError("invalid_input", "Invalid request.", 400);
  return body as Record<string, unknown>;
}
/** Record the authenticated request BEFORE mutation; an audit failure prevents
 * the mutation. This is an attempt log, not an assertion the RPC succeeded.
 */
async function auditRequest(actorId: string, userId: string, action: string, metadata: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from("admin_audit_logs").insert({ actor_id: actorId, target_id: userId, action, metadata });
  if (error) throw new EntitlementError("audit_unavailable", "The action was not started because its audit record could not be saved.");
}

export async function GET(_req: NextRequest, context: Context) {
  try {
    const { userId } = await authorize(context);
    const [rollout, result] = await Promise.all([
      getEntitlementRollout(),
      supabaseAdmin.from("v6_pro_periods").select("id, starts_at, ends_at, cancelled_at").eq("user_id", userId).order("starts_at", { ascending: false }),
    ]);
    if (result.error) throw new EntitlementError("accounting_unavailable", "Unable to load subscription periods.");
    return reply({ periods: result.data ?? [], accountingEnabled: rollout.enabled, checkoutEnabled: false });
  } catch (error) { return failure(error); }
}

export async function POST(req: NextRequest, context: Context) {
  try {
    const { actorId, userId } = await authorize(context);
    let body: Record<string, unknown>;
    try { body = await readBody(req); } catch (error) {
      if (error instanceof SyntaxError) throw new EntitlementError("invalid_input", "Invalid JSON body.", 400);
      throw error;
    }
    const start = parsePeriodTimestamp(body.startsAt), end = parsePeriodTimestamp(body.endsAt);
    if (!isEntitlementUuid(body.periodId) || !start || !end) throw new EntitlementError("invalid_period", "Provide a stable period ID and exact start/end timestamps with a time zone.", 400);
    if (end.getTime() <= Date.now()
      || nextUtcMonth(start).getTime() !== end.getTime()) throw new EntitlementError("invalid_monthly_period", "Provide one explicit UTC calendar-month period whose end is in the future.", 400);
    const dates = { periodId: body.periodId, startsAt: start.toISOString(), endsAt: end.toISOString() };
    await auditRequest(actorId, userId, "v6_pro_period_configuration_requested", dates);
    const result = await callEntitlementRpc("v6_set_pro_period", { p_actor_id: actorId, p_user_id: userId,
      p_period_id: dates.periodId, p_starts_at: dates.startsAt, p_ends_at: dates.endsAt });
    return reply({ result, message: "Period saved. No payment was collected; inactive V6 accounting remains inactive." });
  } catch (error) { return failure(error); }
}

export async function DELETE(req: NextRequest, context: Context) {
  try {
    const { actorId, userId } = await authorize(context);
    let body: Record<string, unknown>;
    try { body = await readBody(req); } catch (error) {
      if (error instanceof SyntaxError) throw new EntitlementError("invalid_input", "Invalid JSON body.", 400);
      throw error;
    }
    if (!isEntitlementUuid(body.periodId)) throw new EntitlementError("invalid_period", "A period ID is required.", 400);
    await auditRequest(actorId, userId, "v6_pro_period_cancellation_requested", { periodId: body.periodId });
    await callEntitlementRpc("v6_cancel_pro_period", { p_actor_id: actorId, p_user_id: userId, p_period_id: body.periodId });
    return reply({ success: true });
  } catch (error) { return failure(error); }
}
