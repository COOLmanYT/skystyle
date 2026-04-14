import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DEMO_USER_ID } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import Link from "next/link";
import HamburgerNav from "@/components/HamburgerNav";
import ClosetHighlighter from "@/components/ClosetHighlighter";

export const dynamic = "force-dynamic";

/** Converts an item name to the same slug used for element IDs */
function itemSlug(name: string): string {
  return "closet-item-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export default async function ClosetPage({
  searchParams,
}: {
  searchParams?: { highlight?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;
  const isDemo =
    userId === DEMO_USER_ID ||
    (session.user as unknown as Record<string, unknown>).plan === "demo";

  let items: string[] = [];
  if (!isDemo) {
    const { data } = await supabaseAdmin
      .from("closet")
      .select("items")
      .eq("user_id", userId)
      .single();
    items = data?.items ?? [];
  }

  const userName = session.user.name ?? session.user.email ?? undefined;
  const highlight = typeof searchParams?.highlight === "string" ? searchParams.highlight : null;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--background)" }}
    >
      <HamburgerNav currentPage="closet" userName={userName} title="👕 Closet" />
      <ClosetHighlighter highlight={highlight} />

      <div className="flex-1 flex flex-col items-center justify-start py-8 px-4">
        <div className="w-full max-w-lg space-y-6">
          <div
            className="rounded-2xl p-6 space-y-4"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}
          >
            <h1
              className="text-xl font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              👕 My Closet
            </h1>

            <div className="space-y-3">
              <p
                className="text-xs"
                style={{ color: "var(--foreground)", opacity: 0.5 }}
              >
                {items.length} item{items.length !== 1 ? "s" : ""} in your wardrobe
              </p>

              {items.length === 0 ? (
                <div
                  className="rounded-xl p-4 text-center space-y-2"
                  style={{
                    background: "var(--background)",
                    border: "1px dashed var(--card-border)",
                  }}
                >
                  <p className="text-2xl" aria-hidden="true">👗</p>
                  <p
                    className="text-sm"
                    style={{ color: "var(--foreground)", opacity: 0.6 }}
                  >
                    Your closet is empty. Add items in the Dashboard to get started.
                  </p>
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {items.map((item) => (
                    <li
                      key={item}
                      id={itemSlug(item)}
                      className="rounded-xl px-4 py-2.5 text-sm flex items-center gap-2"
                      style={{
                        background: "var(--background)",
                        border: "1px solid var(--card-border)",
                        color: "var(--foreground)",
                      }}
                    >
                      <span aria-hidden="true">👗</span>
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              <Link
                href="/dashboard"
                className="block w-full text-center rounded-xl py-2.5 text-sm font-medium mt-2 transition-opacity hover:opacity-80"
                style={{
                  background: "var(--background)",
                  border: "1px solid var(--card-border)",
                  color: "var(--foreground)",
                }}
              >
                ← Manage in Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
