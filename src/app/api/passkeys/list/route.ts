import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";
import { logSecurityEvent } from "@/lib/security";
import { NextResponse, NextRequest } from "next/server";

/** GET /api/passkeys/list — List the user's registered passkeys. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await syncPublicUser(session);

  const { data, error } = await supabaseAdmin
    .from("passkeys")
    .select("id, display_name, transports, created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** DELETE /api/passkeys/list — Remove a passkey by id. */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await syncPublicUser(session);

  const { id } = await req.json().catch(() => ({}));
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing passkey id" }, { status: 400 });
  }

  // Verify ownership
  const { data: pk } = await supabaseAdmin
    .from("passkeys")
    .select("id, display_name")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single();

  if (!pk) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabaseAdmin
    .from("passkeys")
    .delete()
    .eq("id", id)
    .eq("user_id", session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  await logSecurityEvent(session.user.id, "passkey_removed", { displayName: pk.display_name }, ip);

  return NextResponse.json({ success: true });
}
