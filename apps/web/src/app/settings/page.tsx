import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  let unitPreference: "metric" | "imperial" = "metric";

  if (session.user.id) {
    try {
      const { data } = await supabaseAdmin
        .from("settings")
        .select("unit_preference")
        .eq("user_id", session.user.id)
        .single();
      if (data?.unit_preference === "imperial") {
        unitPreference = "imperial";
      }
    } catch { /* Non-fatal */ }
  }

  return <SettingsClient initialUnitPreference={unitPreference} />;
}
