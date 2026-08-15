import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";

async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  await syncPublicUser(session);
  return session.user.id;
}

export async function GET() {
  const userId = await currentUser();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [messagesResult, preferencesResult] = await Promise.all([
    supabaseAdmin.from("user_inbox").select("*").eq("user_id", userId).is("dismissed_at", null).order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  if (messagesResult.error || preferencesResult.error) return NextResponse.json({ error: "Failed to load inbox." }, { status: 500 });
  return NextResponse.json({ messages: messagesResult.data ?? [], preferences: preferencesResult.data ?? null });
}

export async function PATCH(req: NextRequest) {
  const userId = await currentUser();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  if (typeof body.messageId === "string") {
    const updates: Record<string, string> = {};
    if (body.read === true) updates.read_at = new Date().toISOString();
    if (body.dismissed === true) updates.dismissed_at = new Date().toISOString();
    const { error } = await supabaseAdmin.from("user_inbox").update(updates).eq("id", body.messageId).eq("user_id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.preferences && typeof body.preferences === "object") {
    const preferences = body.preferences as Record<string, unknown>;
    const { error } = await supabaseAdmin.from("notification_preferences").upsert({
      user_id: userId,
      browser_notifications: preferences.browserNotifications === true,
      muted_categories: Array.isArray(preferences.mutedCategories) ? preferences.mutedCategories.filter((item) => typeof item === "string").slice(0, 20) : [],
      blocked_categories: Array.isArray(preferences.blockedCategories) ? preferences.blockedCategories.filter((item) => typeof item === "string").slice(0, 20) : [],
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
