import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse, NextRequest } from "next/server";

/** Verify the request is from a dev-authorized user. */
function getDevEmails(): Set<string> {
  const raw = process.env.DEV_EMAILS ?? "";
  return new Set(raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

async function requireDev() {
  const session = await auth();
  if (!session?.user?.email) return null;
  if (!getDevEmails().has(session.user.email.toLowerCase())) return null;
  return session;
}

/** GET /api/dev/deletion-requests — List all pending deletion requests. */
export async function GET() {
  const session = await requireDev();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("deletion_requests")
    .select(`
      id, status, reason, admin_note, created_at, resolved_at,
      user_id,
      users!inner(name, email)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** PATCH /api/dev/deletion-requests — Approve or decline a deletion request. */
export async function PATCH(req: NextRequest) {
  const session = await requireDev();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { id, action, admin_note } = body;

  if (!id || !["approve", "decline"].includes(action)) {
    return NextResponse.json({ error: "Missing id or invalid action" }, { status: 400 });
  }

  const status = action === "approve" ? "approved" : "declined";

  const { error } = await supabaseAdmin
    .from("deletion_requests")
    .update({
      status,
      admin_note: admin_note ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If approved, clear the pending_deletion flag (actual data deletion is a separate step)
  if (action === "approve") {
    const { data: req_ } = await supabaseAdmin
      .from("deletion_requests")
      .select("user_id")
      .eq("id", id)
      .single();
    if (req_?.user_id) {
      await supabaseAdmin
        .from("users")
        .update({ pending_deletion: false })
        .eq("id", req_.user_id);
    }
  }

  return NextResponse.json({ success: true });
}
