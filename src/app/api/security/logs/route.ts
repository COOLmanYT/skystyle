import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";
import { NextResponse } from "next/server";

/** GET /api/security/logs — Return the user's security audit log. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await syncPublicUser(session);

  const { data, error } = await supabaseAdmin
    .from("security_logs")
    .select("id, event_type, metadata, ip_address, created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
