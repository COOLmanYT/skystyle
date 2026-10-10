import { NextRequest, NextResponse } from "next/server";
import { auth, DEMO_USER_ID } from "@/auth";
import { syncPublicUser } from "@/lib/sync-user";
import { supabaseAdmin } from "@/lib/supabase";
import { readWardrobe } from "@/lib/wardrobe-server";
import { parseWardrobeItem, isUuid } from "@/lib/wardrobe";
export const dynamic = "force-dynamic";
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.id === DEMO_USER_ID) return NextResponse.json({ items: [], wardrobeItems: [], revision: 0, persistence: "temporary" });
  try { await syncPublicUser(session); return NextResponse.json(await readWardrobe(session.user.id)); }
  catch { return NextResponse.json({ error: "Wardrobe storage is not ready. Please retry when the update is available." }, { status: 503 }); }
}
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.id === DEMO_USER_ID) return NextResponse.json({ error: "Demo changes are temporary." }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || !Number.isSafeInteger(body.revision) || body.revision < 0 || !body.operation) return NextResponse.json({ error: "A wardrobe revision and operation are required." }, { status: 400 });
  let operation;
  try {
    if (["add", "update"].includes(body.operation.type)) operation = { type: body.operation.type, item: parseWardrobeItem(body.operation.item) };
    else if (body.operation.type === "delete" && Array.isArray(body.operation.ids) && body.operation.ids.length > 0 && body.operation.ids.length <= 500 && body.operation.ids.every(isUuid)) operation = { type: "delete", ids: body.operation.ids };
    else throw new Error("Invalid operation.");
  } catch { return NextResponse.json({ error: "Invalid wardrobe operation." }, { status: 400 }); }
  try {
    await syncPublicUser(session);
    const { data, error } = await supabaseAdmin.rpc("v63_mutate_wardrobe", { p_user_id: session.user.id, p_expected_revision: body.revision, p_operation: operation });
    if (error?.message.includes("wardrobe_conflict")) return NextResponse.json({ error: "Your wardrobe changed elsewhere. Review the latest items and retry your draft.", current: await readWardrobe(session.user.id) }, { status: 409 });
    if (error) throw error;
    return NextResponse.json(data);
  } catch { return NextResponse.json({ error: "Could not save your wardrobe. Your draft is preserved; please retry." }, { status: 503 }); }
}
