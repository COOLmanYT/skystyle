import { auth } from "@/auth";
import { redirect } from "next/navigation";
import HamburgerNav from "@/components/HamburgerNav";
import SavedOutfits from "@/components/SavedOutfits";
import { handleSignOut } from "@/app/actions";
export const dynamic = "force-dynamic";
export default async function OutfitsPage() {
  const session=await auth(); if(!session?.user?.id) redirect("/login");
  return <div className="min-h-screen" style={{background:"var(--background)",color:"var(--foreground)"}}><HamburgerNav currentPage="other" title="Saved outfits" signOutAction={handleSignOut}/><main id="main-content" className="mx-auto max-w-2xl p-6"><SavedOutfits userId={session.user.id}/></main></div>;
}
