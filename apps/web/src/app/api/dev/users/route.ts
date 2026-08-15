import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getDevEmails } from "@/lib/dev-auth";

async function requireDev() {
  const session = await auth();
  return session?.user?.id && session.user.email && getDevEmails().has(session.user.email.toLowerCase()) ? session : null;
}

async function audit(actorId: string, targetId: string, action: string, metadata: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from("admin_audit_logs").insert({
    actor_id: actorId,
    target_id: targetId,
    action,
    metadata,
  });
  if (error) throw error;
}

export async function GET() {
  const session = await requireDev();
  if (!session?.user?.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const today = new Date().toISOString().slice(0, 10);
  const [usersResult, controlsResult, usageResult, creditsResult, apiKeysResult] = await Promise.all([
    supabaseAdmin.from("users").select("id, name, email, is_pro, is_dev").order("email").limit(500),
    supabaseAdmin.from("user_access_controls").select("*"),
    supabaseAdmin.from("daily_usage").select("user_id, ai_uses, follow_ups, usage_date").eq("usage_date", today),
    supabaseAdmin.from("credits").select("user_id, current_balance"),
    supabaseAdmin.from("api_keys").select("user_id, revoked, credits_remaining"),
  ]);
  for (const result of [usersResult, controlsResult, usageResult, creditsResult, apiKeysResult]) {
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  const controls = new Map((controlsResult.data ?? []).map((row) => [row.user_id, row]));
  const usage = new Map((usageResult.data ?? []).map((row) => [row.user_id, row]));
  const credits = new Map((creditsResult.data ?? []).map((row) => [row.user_id, row.current_balance]));
  const apiKeys = apiKeysResult.data ?? [];
  return NextResponse.json((usersResult.data ?? []).map((user) => ({
    ...user,
    controls: controls.get(user.id) ?? null,
    usage: usage.get(user.id) ?? null,
    credits: credits.get(user.id) ?? 0,
    apiKeys: apiKeys.filter((key) => key.user_id === user.id).map((key) => ({ revoked: key.revoked, creditsRemaining: key.credits_remaining })),
  })));
}

export async function PATCH(req: NextRequest) {
  const session = await requireDev();
  if (!session?.user?.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.userId !== "string") return NextResponse.json({ error: "userId is required" }, { status: 400 });
  const updates: Record<string, unknown> = { user_id: body.userId, updated_by: session.user.id, updated_at: new Date().toISOString() };
  if (typeof body.appBlocked === "boolean") updates.app_blocked = body.appBlocked;
  if (typeof body.apiBlocked === "boolean") updates.api_blocked = body.apiBlocked;
  if (typeof body.appDailyAiLimit === "number" && Number.isInteger(body.appDailyAiLimit) && body.appDailyAiLimit >= 0) updates.app_daily_ai_limit = body.appDailyAiLimit;
  if (typeof body.apiRateLimitPerMin === "number" && Number.isInteger(body.apiRateLimitPerMin) && body.apiRateLimitPerMin >= 0) updates.api_rate_limit_per_min = body.apiRateLimitPerMin;
  if (typeof body.reason === "string") updates.reason = body.reason.slice(0, 500);

  const { error: controlError } = await supabaseAdmin
    .from("user_access_controls")
    .upsert(updates, { onConflict: "user_id" });
  if (controlError) return NextResponse.json({ error: controlError.message }, { status: 500 });

  const giftCredits = typeof body.giftAppCredits === "number" && Number.isInteger(body.giftAppCredits)
    ? body.giftAppCredits
    : 0;
  if (giftCredits !== 0) {
    const { data: credit, error: creditReadError } = await supabaseAdmin
      .from("credits").select("current_balance").eq("user_id", body.userId).maybeSingle();
    if (creditReadError) return NextResponse.json({ error: creditReadError.message }, { status: 500 });
    const balance = Math.max(0, Number(credit?.current_balance ?? 0) + giftCredits);
    const { error: creditError } = await supabaseAdmin.from("credits").upsert({
      user_id: body.userId,
      current_balance: balance,
      last_reset_date: new Date().toISOString().slice(0, 10),
    }, { onConflict: "user_id" });
    if (creditError) return NextResponse.json({ error: creditError.message }, { status: 500 });
  }
  try {
    await audit(session.user.id, body.userId, "user_access_updated", { ...updates, giftCredits });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to audit admin action." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
