export const dynamic = "force-dynamic";

/**
 * GET /api/v1/closet
 *
 * Returns the clothing items stored in the authenticated user's closet.
 * The key owner's closet is returned — no user_id parameter needed.
 * Authenticated via API key.
 *
 * Authentication:
 *   Authorization: Bearer sk_live_<token>
 *
 * Response (200):
 *   items   string[]  Array of clothing item descriptions
 *   count   number    Total number of items
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { withApiAuth, ApiKeyContext } from "@/lib/api-middleware";

async function handleCloset(
  _req: NextRequest,
  ctx: ApiKeyContext
): Promise<NextResponse> {
  const { userId } = ctx;

  const { data, error } = await supabaseAdmin
    .from("closet")
    .select("items")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: "Failed to fetch closet." }, { status: 500 });
  }

  const items: string[] = Array.isArray(data?.items)
    ? (data.items as unknown[]).filter((i): i is string => typeof i === "string")
    : [];

  return NextResponse.json({ items, count: items.length });
}

export const GET = withApiAuth(handleCloset);
