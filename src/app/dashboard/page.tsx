import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { supabaseAdmin } from "@/lib/supabase";
import { getCredits } from "@/lib/credits";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const name = session.user.name?.split(" ")[0] ?? session.user.email ?? "there";
  const userId = session.user.id;

  let isPro = false;
  let initialCredits: number | null = null;

  if (userId) {
    try {
      const { data } = await supabaseAdmin
        .from("users")
        .select("is_pro")
        .eq("id", userId)
        .single();
      isPro = data?.is_pro ?? false;
      if (isPro) {
        initialCredits = await getCredits(userId);
      }
    } catch {
      // Non-fatal: dashboard still works without credits info
    }
  }

  return <Dashboard userName={name} isPro={isPro} initialCredits={initialCredits} />;
}
