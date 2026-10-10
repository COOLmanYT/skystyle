import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";
import { logSecurityEvent } from "@/lib/security";
import { NextResponse, NextRequest } from "next/server";
import { getActiveAccounting } from "@/lib/accounting";

/**
 * GET /api/privacy/export
 * Packages all user data into a nested, human-readable JSON object.
 * Returns it as an attachment download.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await syncPublicUser(session);

  const userId = session.user.id;
  let accountAccounting;
  try { accountAccounting = await getActiveAccounting(userId); }
  catch { return NextResponse.json({error:"Unable to verify account accounting for this export."},{status:503}); }

  // Fetch all user data in parallel
  const [
    userRow,
    settingsRow,
    closetRow,
    dailyUsage,
    feedbackRows,
    securityLogs,
    passkeys,
    deletionReq,
    stylePreferences,
    savedOutfits,
  ] = await Promise.all([
    supabaseAdmin.from("users").select("*").eq("id", userId).single(),
    supabaseAdmin.from("settings").select("*").eq("user_id", userId).single(),
    supabaseAdmin.from("closet").select("*").eq("user_id", userId).single(),
    supabaseAdmin.from("daily_usage").select("*").eq("user_id", userId).order("usage_date", { ascending: false }),
    supabaseAdmin.from("feedback").select("category, rating, comment, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    supabaseAdmin.from("security_logs").select("event_type, metadata, ip_address, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
    supabaseAdmin.from("passkeys").select("display_name, transports, created_at").eq("user_id", userId),
    supabaseAdmin.from("deletion_requests").select("status, reason, created_at").eq("user_id", userId).single(),
    supabaseAdmin.from("style_feedback_preferences").select("entries, summary, updated_at").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("saved_outfits").select("*").eq("user_id",userId).order("created_at"),
  ]);

  if (stylePreferences.error || savedOutfits.error) {
    return NextResponse.json({ error: "Unable to include private style feedback. Please retry your export." }, { status: 503 });
  }

  const exportData = {
    exported_at: new Date().toISOString(),
    schema_version: "2.1.0",
    profile: {
      id: userRow.data?.id,
      name: userRow.data?.name,
      email: userRow.data?.email,
      image: userRow.data?.image,
      plan: accountAccounting?.plan ?? (userRow.data?.is_dev ? "dev" : userRow.data?.is_pro ? "pro" : "free"),
      pending_deletion: userRow.data?.pending_deletion ?? false,
      mfa_enabled: userRow.data?.mfa_enabled ?? false,
    },
    settings: {
      unit_preference: settingsRow.data?.unit_preference ?? "metric",
      custom_system_prompt: settingsRow.data?.custom_system_prompt ?? null,
      comfort_preferences: settingsRow.data?.comfort_preferences ?? null,
      feedback_storage_mode: settingsRow.data?.feedback_storage_mode ?? "local",
    },
    closet: {
      items: closetRow.data?.items ?? [],
      wardrobe_items: closetRow.data?.wardrobe_items ?? [],
      revision: closetRow.data?.revision ?? null,
    },
    saved_outfits: savedOutfits.data ?? [],
    local_comfort_note: "Device-only comfort settings are not held on the server. View or delete them on each device.",
    daily_usage: dailyUsage.data ?? [],
    account_accounting:accountAccounting,
    feedback: feedbackRows.data ?? [],
    private_style_feedback: stylePreferences.data ?? null,
    local_style_feedback_note: "Device-only feedback is not held on the server. View or delete it in Settings on each device.",
    registered_passkeys: passkeys.data ?? [],
    security_audit_log: securityLogs.data ?? [],
    deletion_request: deletionReq.data ?? null,
  };

  const json = JSON.stringify(exportData, null, 2);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  await logSecurityEvent(userId, "data_export", {}, ip);

  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="skystyle-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
