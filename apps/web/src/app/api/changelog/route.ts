import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export interface ChangelogCta {
  text: string;
  url: string;
}

export interface ChangelogEntry {
  date: string;
  version: string;
  title: string;
  description: string;
  /** e.g. "✨ Feature", "🐛 Fix", "📣 Promotion", "🎨 Design" */
  category?: string;
  /** "update" = technical/compact, "post" = marketing/long-form */
  type?: "update" | "post";
  /** Full Markdown extended description */
  content?: string;
  /** Header or inline image URL */
  image?: string;
  /** Call-to-action rendered as a plan-gradient button */
  cta?: ChangelogCta;
  /** If true, entry has a dedicated /changelog/[slug] page */
  expanded?: boolean;
  /** URL-safe slug for /changelog/[slug] */
  slug?: string;
  /** When true, entry renders in a full modal with "Read more" button */
  large?: boolean;
  /** When true, a popup is shown once on next login */
  showOnNextLogin?: boolean;
}

export async function GET() {
  try {
    const { data: dbRows, error } = await supabaseAdmin
      .from("changelog_posts")
      .select("version, title, body, image_url, published, created_at, category, type, content, image, cta, expanded, slug, large, show_on_next_login")
      .eq("published", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[changelog] Supabase error:", error.message);
      return NextResponse.json([], { status: 200 });
    }

    const entries: ChangelogEntry[] = (dbRows ?? []).map((row) => ({
      date: row.created_at as string,
      version: row.version as string,
      title: row.title as string,
      description: (row.body as string | null) ?? "",
      category: row.category as string | undefined,
      type: row.type as "update" | "post" | undefined,
      content: (row.content as string | null) ?? undefined,
      image: (row.image as string | null) ?? (row.image_url as string | null) ?? undefined,
      cta: row.cta as ChangelogCta | undefined,
      expanded: (row.expanded as boolean | null) ?? false,
      slug: (row.slug as string | null) ?? undefined,
      large: (row.large as boolean | null) ?? (row.type === "post"),
      showOnNextLogin: (row.show_on_next_login as boolean | null) ?? false,
    }));

    return NextResponse.json(entries);
  } catch (err) {
    console.error("[changelog] Unexpected error:", err);
    return NextResponse.json([], { status: 200 });
  }
}
