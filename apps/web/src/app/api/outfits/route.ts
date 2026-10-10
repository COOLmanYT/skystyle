import { NextRequest, NextResponse } from "next/server";
import { auth, DEMO_USER_ID } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";
import { parseOutfitPayload } from "@/lib/outfits";
import { isUuid } from "@/lib/wardrobe";
export const dynamic = "force-dynamic";
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.id === DEMO_USER_ID) return NextResponse.json({ outfits: [], persistence: "temporary" });
  const { data, error } = await supabaseAdmin.from("saved_outfits").select("*").eq("user_id", session.user.id).order("updated_at", { ascending: false });
  return error ? NextResponse.json({ error: "Could not load saved outfits. Please retry." }, { status: 503 }) : NextResponse.json({ outfits: data ?? [] });
}
async function write(req: NextRequest, method: "add" | "update" | "delete") {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.id === DEMO_USER_ID) return NextResponse.json({ error: "Demo outfits are temporary." }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || !isUuid(body.id) || method !== "add" && (!Number.isSafeInteger(body.revision) || body.revision < 0)) return NextResponse.json({ error: "An outfit ID and revision are required." }, { status: 400 });
  let payload;
  if (method !== "delete") {
    try { payload = parseOutfitPayload(body.payload); } catch { return NextResponse.json({ error: "Invalid outfit." }, { status: 400 }); }
    if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 80) return NextResponse.json({ error: "Choose an outfit name up to 80 characters." }, { status: 400 });
  }
  await syncPublicUser(session);
  const { data, error } = await supabaseAdmin.rpc("v63_mutate_outfit", { p_user_id: session.user.id, p_id: body.id, p_revision: body.revision ?? 0, p_action: method, p_title: body.title?.trim() ?? "", p_payload: payload ?? {} });
  if (error) return NextResponse.json({ error: error.message.includes("outfit_conflict") ? "This outfit changed elsewhere. Reload and review before retrying." : "Could not save your outfit. Please retry." }, { status: error.message.includes("outfit_conflict") ? 409 : 503 });
  return NextResponse.json(data);
}
export const POST = (req: NextRequest) => write(req, "add");
export const PATCH = (req: NextRequest) => write(req, "update");
export const DELETE = (req: NextRequest) => write(req, "delete");
