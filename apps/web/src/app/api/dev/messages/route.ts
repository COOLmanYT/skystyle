import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse, NextRequest } from "next/server";

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

/** GET /api/dev/messages?userId=<uid> — Load chat messages for a user. */
export async function GET(req: NextRequest) {
  const session = await requireDev();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("dev_messages")
    .select("id, content, from_dev, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/dev/messages — Send a message from dev to a user (or from user). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { content, userId } = body;

  if (!content || typeof content !== "string" || content.length > 5000) {
    return NextResponse.json({ error: "Invalid content" }, { status: 400 });
  }

  const isDevSender = getDevEmails().has(session.user.email?.toLowerCase() ?? "");

  // Dev sends to a user; user sends to themselves (dev reads later)
  const targetUserId = isDevSender && userId ? userId : session.user.id;

  const { error } = await supabaseAdmin.from("dev_messages").insert({
    user_id: targetUserId,
    content: content.trim(),
    from_dev: isDevSender,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
