import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";
import SecurityClient from "./SecurityClient";

export const metadata = {
  title: "Security — Sky Style",
};

export default async function SecurityPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await syncPublicUser(session);

  let mfaEnabled = false;

  try {
    const { data } = await supabaseAdmin
      .from("users")
      .select("mfa_enabled")
      .eq("id", session.user.id!)
      .single();
    mfaEnabled = data?.mfa_enabled ?? false;
  } catch { /* Non-fatal */ }

  return <SecurityClient mfaEnabled={mfaEnabled} />;
}
