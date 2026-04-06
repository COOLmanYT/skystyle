export const dynamic = "force-dynamic";
/**
 * GET  /api/closet        – fetch closet items
 * POST /api/closet        – add an item
 * DELETE /api/closet      – remove an item  (body: { item: string })
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("closet")
    .select("items")
    .eq("user_id", session.user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data?.items ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { item } = await req.json();
  if (!item || typeof item !== "string") {
    return NextResponse.json({ error: "item is required" }, { status: 400 });
  }

  const userId = session.user.id;

  // Sync NextAuth user to public.users (required for FK references in app tables)
  await syncPublicUser(session);

  // Upsert: append item to existing array
  const { data: existing } = await supabaseAdmin
    .from("closet")
    .select("items")
    .eq("user_id", userId)
    .single();

  const items: string[] = existing?.items ?? [];
  if (!items.includes(item)) items.push(item);

  await supabaseAdmin
    .from("closet")
    .upsert({ user_id: userId, items }, { onConflict: "user_id" });

  return NextResponse.json({ items });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { item } = await req.json();
  if (!item || typeof item !== "string") {
    return NextResponse.json({ error: "item is required" }, { status: 400 });
  }

  const userId = session.user.id;

  // Sync NextAuth user to public.users (required for FK references in app tables)
  await syncPublicUser(session);
  const { data: existing } = await supabaseAdmin
    .from("closet")
    .select("items")
    .eq("user_id", userId)
    .single();

  const items: string[] = (existing?.items ?? []).filter(
    (i: string) => i !== item
  );

  await supabaseAdmin
    .from("closet")
    .upsert({ user_id: userId, items }, { onConflict: "user_id" });

  return NextResponse.json({ items });
}
