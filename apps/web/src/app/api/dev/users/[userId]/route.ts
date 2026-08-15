import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDevEmails } from "@/lib/dev-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user?.email || !getDevEmails().has(session.user.email.toLowerCase())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { userId } = await params;
  const [user, settings, closet, messages, feedback, usage, controls, keys, wallet] = await Promise.all([
    supabaseAdmin.from("users").select("*").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("settings").select("*").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("closet").select("*").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("dev_messages").select("content, from_dev, read_at, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
    supabaseAdmin.from("feedback").select("id, category, rating, comment, source, status, created_at, updated_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("daily_usage").select("*").eq("user_id", userId).order("usage_date", { ascending: false }).limit(365),
    supabaseAdmin.from("user_access_controls").select("*").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("api_keys").select("id, key_preview, nickname, folder, revoked, credits_remaining, credits_used, created_at").eq("user_id", userId),
    supabaseAdmin.from("credit_wallets").select("money_credit_cents").eq("user_id", userId).maybeSingle(),
  ]);
  if (!user.data) return NextResponse.json({ error: "User not found." }, { status: 404 });
  for (const result of [settings, closet, messages, feedback, usage, controls, keys, wallet]) if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  const ids = (keys.data ?? []).map((key) => key.id);
  const { data: apiUsage, error: apiUsageError } = ids.length ? await supabaseAdmin.from("api_usage_logs").select("api_key_id, endpoint, timestamp, status_code, response_time").in("api_key_id", ids).order("timestamp", { ascending: false }).limit(500) : { data: [], error: null };
  if (apiUsageError) return NextResponse.json({ error: apiUsageError.message }, { status: 500 });
  return NextResponse.json({ user: user.data, settings: settings.data, closet: closet.data, messages: messages.data ?? [], feedback: feedback.data ?? [], usage: usage.data ?? [], controls: controls.data, keys: keys.data ?? [], wallet: wallet.data, apiUsage: apiUsage ?? [] });
}
