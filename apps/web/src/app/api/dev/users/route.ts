import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getDevEmails } from "@/lib/dev-auth";

async function requireDev() {
  const session = await auth();
  return session?.user?.id && session.user.email && getDevEmails().has(session.user.email.toLowerCase()) ? session : null;
}

async function audit(actorId: string, targetId: string, action: string, metadata: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from("admin_audit_logs").insert({ actor_id: actorId, target_id: targetId, action, metadata });
  if (error) throw error;
}

function missingColumn(error: { code?: string; message?: string } | null, column: string): boolean {
  return !!error && (error.code === "42703" || error.code === "PGRST204") && (error.message ?? "").includes(column);
}

export async function GET() {
  const session = await requireDev();
  if (!session?.user?.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const usersResult = await supabaseAdmin.from("users").select("id, name, email, is_pro, is_dev, pending_deletion, created_at").order("email").limit(500);
  let userRows = usersResult.data;
  let usersError = usersResult.error;
  if (missingColumn(usersError, "created_at")) {
    const legacyUsersResult = await supabaseAdmin.from("users").select("id, name, email, is_pro, is_dev, pending_deletion").order("email").limit(500);
    userRows = (legacyUsersResult.data ?? []).map((user) => ({ ...user, created_at: null }));
    usersError = legacyUsersResult.error;
  }
  const [controlsResult, usageResult, creditsResult, apiKeysResult, feedbackResult, deletionResult] = await Promise.all([
    supabaseAdmin.from("user_access_controls").select("*"),
    supabaseAdmin.from("daily_usage").select("user_id, ai_uses, follow_ups, usage_date").limit(10_000),
    supabaseAdmin.from("credits").select("user_id, current_balance"),
    supabaseAdmin.from("api_keys").select("user_id, revoked, credits_remaining"),
    supabaseAdmin.from("feedback").select("user_id"),
    supabaseAdmin.from("deletion_requests").select("user_id, status"),
  ]);
  for (const result of [controlsResult, usageResult, creditsResult, apiKeysResult, feedbackResult, deletionResult]) {
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 });

  const today = new Date().toISOString().slice(0, 10);
  const controls = new Map((controlsResult.data ?? []).map((row) => [row.user_id, row]));
  const todayUsage = new Map((usageResult.data ?? []).filter((row) => row.usage_date === today).map((row) => [row.user_id, row]));
  const totalUsage = new Map<string, number>();
  for (const row of usageResult.data ?? []) totalUsage.set(row.user_id, (totalUsage.get(row.user_id) ?? 0) + Number(row.ai_uses ?? 0));
  const credits = new Map((creditsResult.data ?? []).map((row) => [row.user_id, row.current_balance]));
  const feedbackCount = new Map<string, number>();
  for (const row of feedbackResult.data ?? []) feedbackCount.set(row.user_id, (feedbackCount.get(row.user_id) ?? 0) + 1);
  const pendingDeletion = new Set((deletionResult.data ?? []).filter((row) => row.status === "pending").map((row) => row.user_id));
  const apiKeys = apiKeysResult.data ?? [];

  return NextResponse.json((userRows ?? []).map((user) => ({
    ...user,
    plan: user.is_dev ? "dev" : user.is_pro ? "pro" : "free",
    joinedAt: user.created_at ?? null,
    pendingDeletion: user.pending_deletion || pendingDeletion.has(user.id),
    feedbackCount: feedbackCount.get(user.id) ?? 0,
    totalAiUses: totalUsage.get(user.id) ?? 0,
    controls: controls.get(user.id) ?? null,
    usage: todayUsage.get(user.id) ?? null,
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
  const { error: controlError } = await supabaseAdmin.from("user_access_controls").upsert(updates, { onConflict: "user_id" });
  if (controlError) return NextResponse.json({ error: controlError.message }, { status: 500 });

  const giftCredits = typeof body.giftAppCredits === "number" && Number.isInteger(body.giftAppCredits) ? body.giftAppCredits : 0;
  if (giftCredits !== 0) {
    const { data: credit, error: creditReadError } = await supabaseAdmin.from("credits").select("current_balance").eq("user_id", body.userId).maybeSingle();
    if (creditReadError) return NextResponse.json({ error: creditReadError.message }, { status: 500 });
    const balance = Math.max(0, Number(credit?.current_balance ?? 0) + giftCredits);
    const { error: creditError } = await supabaseAdmin.from("credits").upsert({ user_id: body.userId, current_balance: balance, last_reset_date: new Date().toISOString().slice(0, 10) }, { onConflict: "user_id" });
    if (creditError) return NextResponse.json({ error: creditError.message }, { status: 500 });
  }
  try {
    await audit(session.user.id, body.userId, "user_access_updated", { ...updates, giftCredits });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to audit admin action." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await requireDev();
  if (!session?.user?.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.userId !== "string" || typeof body.confirmation !== "string") return NextResponse.json({ error: "A user and confirmation are required." }, { status: 400 });
  if (body.userId === session.user.id) return NextResponse.json({ error: "You cannot delete your own developer account here." }, { status: 409 });

  const { data: target, error: targetError } = await supabaseAdmin.from("users").select("id, email, is_dev").eq("id", body.userId).maybeSingle();
  if (targetError || !target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (target.is_dev) return NextResponse.json({ error: "Developer accounts are protected from deletion." }, { status: 409 });
  if (!target.email || body.confirmation.trim().toLowerCase() !== target.email.toLowerCase()) return NextResponse.json({ error: "Type the user's email address exactly to confirm deletion." }, { status: 400 });

  try {
    await audit(session.user.id, target.id, "user_account_deleted", { deletedUserId: target.id, email: target.email });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to audit account deletion." }, { status: 500 });
  }
  const { error: authDeleteError } = await supabaseAdmin.schema("next_auth").from("users").delete().eq("id", target.id);
  if (authDeleteError) return NextResponse.json({ error: authDeleteError.message }, { status: 500 });
  const { error: appDeleteError } = await supabaseAdmin.from("users").delete().eq("id", target.id);
  if (appDeleteError) return NextResponse.json({ error: appDeleteError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
