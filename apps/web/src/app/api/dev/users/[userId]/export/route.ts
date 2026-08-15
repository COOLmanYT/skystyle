import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDevEmails } from "@/lib/dev-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email || !getDevEmails().has(session.user.email.toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { userId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return NextResponse.json({ error: "Invalid user id." }, { status: 400 });

  const [profile, settings, closet, dailyUsage, feedback, securityLogs, passkeys, deletionRequest, inbox, apiKeys] = await Promise.all([
    supabaseAdmin.from("users").select("id, name, email, image, is_pro, is_dev, mfa_enabled").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("settings").select("*").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("closet").select("*").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("daily_usage").select("*").eq("user_id", userId).order("usage_date", { ascending: false }),
    supabaseAdmin.from("feedback").select("category, rating, comment, status, created_at, updated_at").eq("user_id", userId).order("created_at", { ascending: false }),
    supabaseAdmin.from("security_logs").select("event_type, metadata, ip_address, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
    supabaseAdmin.from("passkeys").select("display_name, transports, created_at").eq("user_id", userId),
    supabaseAdmin.from("deletion_requests").select("status, reason, admin_note, created_at, resolved_at").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("user_inbox").select("category, title, body, metadata, read_at, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    supabaseAdmin.from("api_keys").select("id, key_preview, created_at, revoked, credits_remaining, credits_used").eq("user_id", userId),
  ]);
  if (!profile.data) return NextResponse.json({ error: "User not found." }, { status: 404 });
  for (const result of [settings, closet, dailyUsage, feedback, securityLogs, passkeys, deletionRequest, inbox, apiKeys]) {
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  const apiKeyIds = (apiKeys.data ?? []).map((key) => key.id);
  const { data: apiUsage, error: apiUsageError } = apiKeyIds.length
    ? await supabaseAdmin.from("api_usage_logs").select("endpoint, timestamp, status_code, response_time, request_method, request_input, response_output, error_code, error_message").in("api_key_id", apiKeyIds).order("timestamp", { ascending: false }).limit(1_000)
    : { data: [], error: null };
  if (apiUsageError) return NextResponse.json({ error: apiUsageError.message }, { status: 500 });

  const { error: auditError } = await supabaseAdmin.from("admin_audit_logs").insert({
    actor_id: session.user.id,
    target_id: userId,
    action: "user_data_exported",
    metadata: { exportedAt: new Date().toISOString() },
  });
  if (auditError) return NextResponse.json({ error: auditError.message }, { status: 500 });

  const payload = {
    exported_at: new Date().toISOString(),
    exported_by: "Sky Style developer",
    schema_version: "5.1.0",
    profile: { ...profile.data, pending_deletion: deletionRequest.data?.status === "pending" },
    settings: settings.data ?? null,
    closet: closet.data ?? null,
    daily_usage: dailyUsage.data ?? [],
    feedback: feedback.data ?? [],
    api_keys: apiKeys.data ?? [],
    api_usage: apiUsage ?? [],
    inbox: inbox.data ?? [],
    security_audit_log: securityLogs.data ?? [],
    registered_passkeys: passkeys.data ?? [],
    deletion_request: deletionRequest.data ?? null,
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="skystyle-user-data-${userId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
