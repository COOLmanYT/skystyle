import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";
import { logSecurityEvent } from "@/lib/security";
import { NextResponse, NextRequest } from "next/server";

/**
 * POST /api/privacy/request-deletion
 * Puts the account into pending_deletion state.
 *
 * Body: { reason?: string }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await syncPublicUser(session);

  const body = await req.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason.slice(0, 1000) : null;

  // Upsert deletion request
  const { error } = await supabaseAdmin
    .from("deletion_requests")
    .upsert(
      {
        user_id: session.user.id,
        reason,
        status: "pending",
        admin_note: null,
        resolved_at: null,
      },
      { onConflict: "user_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mark user as pending deletion
  await supabaseAdmin
    .from("users")
    .update({ pending_deletion: true })
    .eq("id", session.user.id);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  await logSecurityEvent(session.user.id, "deletion_requested", { reason }, ip);

  return NextResponse.json({ success: true });
}
