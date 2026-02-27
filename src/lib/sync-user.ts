/**
 * Sync NextAuth user to public.users.
 *
 * @auth/supabase-adapter writes users to the `next_auth` schema.
 * Application tables (credits, closet, settings, daily_usage) reference
 * `public.users(id)` via foreign keys, so inserts will fail with a FK
 * violation unless a matching row exists in `public.users`.
 *
 * Call `syncPublicUser(session)` at the start of any API route that reads
 * from or writes to the public application tables.
 */

import { supabaseAdmin } from "./supabase";
import type { Session } from "next-auth";

/**
 * Upsert a row in public.users from the NextAuth session.
 * Only sets profile fields (id, name, email, image); never touches is_pro.
 */
export async function syncPublicUser(session: Session): Promise<void> {
  const { id, name, email, image } = session.user ?? {};
  if (!id) return;

  const { error } = await supabaseAdmin
    .from("users")
    .upsert(
      { id, name: name ?? null, email: email ?? null, image: image ?? null },
      { onConflict: "id", ignoreDuplicates: false }
    );

  if (error) {
    console.error("[syncPublicUser] Failed to sync user to public.users:", error);
    throw new Error(`Failed to sync user to public.users: ${error.message}`);
  }
}
