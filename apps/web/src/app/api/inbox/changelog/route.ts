import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.version !== "string" || typeof body.title !== "string") return NextResponse.json({ error: "Invalid changelog entry." }, { status: 400 });
  await syncPublicUser(session);
  // Prevent duplicate archival when the same post is seen in another browser.
  const { data: existing, error: readError } = await supabaseAdmin.from("user_inbox").select("id").eq("user_id", session.user.id).eq("category", "changelog").contains("metadata", { version: body.version }).maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (existing) return NextResponse.json({ success: true });
  const { error } = await supabaseAdmin.from("user_inbox").insert({ user_id: session.user.id, category: "changelog", title: body.title.slice(0, 160), body: typeof body.body === "string" ? body.body.slice(0, 5_000) : "", metadata: { version: body.version } });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
