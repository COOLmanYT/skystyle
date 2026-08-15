import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDevEmails } from "@/lib/dev-auth";
import { supabaseAdmin } from "@/lib/supabase";

async function getActor() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: session.user.id, isDev: !!session.user.email && getDevEmails().has(session.user.email.toLowerCase()) };
}

export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const query = supabaseAdmin
    .from("feedback")
    .select("id, user_id, category, rating, comment, created_at, status, updated_at, source")
    .order("updated_at", { ascending: false })
    .limit(actor.isDev ? 200 : 50);
  if (!actor.isDev) query.eq("user_id", actor.id);
  let { data: tickets, error } = await query;
  if (error && (error.code === "42703" || error.code === "PGRST204") && error.message.includes("source")) {
    const legacyQuery = supabaseAdmin
      .from("feedback")
      .select("id, user_id, category, rating, comment, created_at, status, updated_at")
      .order("updated_at", { ascending: false })
      .limit(actor.isDev ? 200 : 50);
    if (!actor.isDev) legacyQuery.eq("user_id", actor.id);
    const legacyResult = await legacyQuery;
    tickets = (legacyResult.data ?? []).map((ticket) => ({ ...ticket, source: "Unknown (legacy)" }));
    error = legacyResult.error;
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const senderIds = [...new Set((tickets ?? []).map((ticket) => ticket.user_id).filter((id): id is string => typeof id === "string"))];
  const { data: senders, error: sendersError } = senderIds.length
    ? await supabaseAdmin.from("users").select("id, name, email").in("id", senderIds)
    : { data: [], error: null };
  if (sendersError) return NextResponse.json({ error: sendersError.message }, { status: 500 });
  const senderById = new Map((senders ?? []).map((sender) => [sender.id, { name: sender.name, email: sender.email }]));
  const ticketIds = (tickets ?? []).map((ticket) => ticket.id);
  const { data: replies, error: repliesError } = ticketIds.length
    ? await supabaseAdmin.from("feedback_replies").select("id, feedback_id, sender_id, from_dev, body, created_at").in("feedback_id", ticketIds).order("created_at")
    : { data: [], error: null };
  if (repliesError) return NextResponse.json({ error: repliesError.message }, { status: 500 });
  return NextResponse.json({
    tickets: (tickets ?? []).map((ticket) => ({
      ...ticket,
      sender: senderById.get(ticket.user_id) ?? { name: null, email: null },
    })),
    replies: replies ?? [],
  });
}

export async function POST(req: NextRequest) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.ticketId !== "string" || typeof body.message !== "string" || !body.message.trim() || body.message.length > 5_000) {
    return NextResponse.json({ error: "A ticket and message are required." }, { status: 400 });
  }
  const { data: ticket, error: ticketError } = await supabaseAdmin.from("feedback").select("id, user_id, status").eq("id", body.ticketId).maybeSingle();
  if (ticketError || !ticket || (!actor.isDev && ticket.user_id !== actor.id)) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  if (ticket.status === "closed") return NextResponse.json({ error: "This ticket is closed." }, { status: 409 });
  const now = new Date().toISOString();
  const [{ error: replyError }, { error: updateError }] = await Promise.all([
    supabaseAdmin.from("feedback_replies").insert({ feedback_id: ticket.id, sender_id: actor.id, from_dev: actor.isDev, body: body.message.trim() }),
    supabaseAdmin.from("feedback").update({ status: actor.isDev ? "waiting_user" : "waiting_dev", updated_at: now }).eq("id", ticket.id),
  ]);
  if (replyError || updateError) return NextResponse.json({ error: replyError?.message ?? updateError?.message }, { status: 500 });
  if (actor.isDev) {
    const { error: inboxError } = await supabaseAdmin.from("user_inbox").insert({
      user_id: ticket.user_id, category: "support", title: "Reply to your feedback", body: body.message.trim(), metadata: { ticketId: ticket.id },
    });
    if (inboxError) return NextResponse.json({ error: inboxError.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.ticketId !== "string" || body.action !== "close") return NextResponse.json({ error: "Invalid close request." }, { status: 400 });
  const { data: ticket } = await supabaseAdmin.from("feedback").select("id, user_id").eq("id", body.ticketId).maybeSingle();
  if (!ticket || (!actor.isDev && ticket.user_id !== actor.id)) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  const { error } = await supabaseAdmin.from("feedback").update({ status: "closed", updated_at: new Date().toISOString() }).eq("id", ticket.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
