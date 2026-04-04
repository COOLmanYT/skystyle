import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";
import { logSecurityEvent } from "@/lib/security";
import { NextResponse, NextRequest } from "next/server";

/**
 * POST /api/privacy/cancel-deletion
 * Cancels a pending deletion request.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await syncPublicUser(session);

  const { error } = await supabaseAdmin
    .from("deletion_requests")
    .delete()
    .eq("user_id", session.user.id)
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin
    .from("users")
    .update({ pending_deletion: false })
    .eq("id", session.user.id);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  await logSecurityEvent(session.user.id, "deletion_cancelled", {}, ip);

  return NextResponse.json({ success: true });
}
