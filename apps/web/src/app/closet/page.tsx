import { auth, DEMO_USER_ID } from "@/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import HamburgerNav from "@/components/HamburgerNav";
import { wardrobeSnapshot, type WardrobeSnapshot } from "@/lib/wardrobe";
import { clothingItemName, clothingAction } from "@/lib/recommendation-links";
import ClosetManager from "@/components/ClosetManager";
import PageSpacingWrapper from "@/components/PageSpacingWrapper";
import { handleSignOut } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ClosetPage({ searchParams }: { searchParams: Promise<{ highlight?: string; item?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const params = await searchParams;
  const userId = session.user.id;
  const isDemo = userId === DEMO_USER_ID || (session.user as Record<string, unknown>).plan === "demo";
  let items: string[] = [];
  let snapshot: WardrobeSnapshot | undefined;
  let isDev = false;
  if (!isDemo) {
    const [closet, profile] = await Promise.all([
      supabaseAdmin.from("closet").select("*").eq("user_id", userId).maybeSingle(),
      supabaseAdmin.from("users").select("is_dev").eq("id", userId).maybeSingle(),
    ]);
    items = Array.isArray(closet.data?.items) ? closet.data.items : [];
    isDev = profile.data?.is_dev ?? false;
    try { snapshot = wardrobeSnapshot(closet.data); } catch { /* Editor offers a retry if storage is unavailable. */ }
    const fallback = clothingItemName(params.item ?? params.highlight);
    if (snapshot && params.highlight && !snapshot.wardrobeItems.some(item => item.id.toLowerCase() === params.highlight?.toLowerCase() || item.label.toLowerCase() === params.highlight?.toLowerCase()) && fallback) redirect(clothingAction(fallback, [])!.href);
  }
  return <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
    <HamburgerNav currentPage="closet" userName={session.user.name ?? session.user.email ?? undefined} title="👕 Closet" signOutAction={handleSignOut} isDev={isDev} />
    <main id="main-content" className="flex-1 py-8 px-4"><PageSpacingWrapper page="closet" className="w-full max-w-2xl mx-auto"><ClosetManager temporary={isDemo} initialItems={items} initialSnapshot={snapshot} highlight={typeof params.highlight === "string" ? params.highlight : null} /></PageSpacingWrapper></main>
  </div>;
}
