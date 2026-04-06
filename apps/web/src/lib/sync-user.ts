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

/** Comma-separated list of emails granted dev mode (from DEV_EMAILS env var). */
function getDevEmails(): Set<string> {
  const raw = process.env.DEV_EMAILS ?? "";
  return new Set(
    raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
  );
}

/**
 * Upsert a row in public.users from the NextAuth session.
 * Sets profile fields (id, name, email, image) and is_dev based on DEV_EMAILS.
 * Never touches is_pro (managed via Supabase dashboard).
 *
 * Note: is_dev is re-evaluated on every sync. Removing an email from
 * DEV_EMAILS will revoke dev privileges on the user's next request.
 *
 * If the is_dev column doesn't exist yet (PGRST204), the upsert is retried
 * without it so the app remains functional. Run the ALTER TABLE migration
 * in schema.sql to add the column.
 */
export async function syncPublicUser(session: Session): Promise<void> {
  const { id, name, email, image } = session.user ?? {};
  if (!id) return;

  const isDev = email ? getDevEmails().has(email.toLowerCase()) : false;
  const basePayload = { id, name: name ?? null, email: email ?? null, image: image ?? null };

  const { error } = await supabaseAdmin
    .from("users")
    .upsert(
      { ...basePayload, is_dev: isDev },
      { onConflict: "id", ignoreDuplicates: false }
    );

  if (error) {
    // If the is_dev column doesn't exist yet, retry without it
    if (error.code === "PGRST204" && error.message?.includes("is_dev")) {
      console.warn("[syncPublicUser] is_dev column not found – syncing without it. Run the ALTER TABLE migration in schema.sql.");
      const { error: retryError } = await supabaseAdmin
        .from("users")
        .upsert(basePayload, { onConflict: "id", ignoreDuplicates: false });
      if (retryError) {
        console.error("[syncPublicUser] Failed to sync user to public.users:", retryError);
        throw new Error(`Failed to sync user to public.users: ${retryError.message}`);
      }
      return;
    }
    console.error("[syncPublicUser] Failed to sync user to public.users:", error);
    throw new Error(`Failed to sync user to public.users: ${error.message}`);
  }
}
