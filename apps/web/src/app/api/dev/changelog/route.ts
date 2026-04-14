import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDevEmails } from "@/lib/dev-auth";
import { supabaseAdmin } from "@/lib/supabase";

export interface ChangelogEntry {
  id?: string;
  date: string;
  version: string;
  title: string;
  description: string;
  category?: string;
  type?: "update" | "post";
  content?: string;
  image?: string;
  imageUrl?: string;
  cta?: { text: string; url: string };
  ctaLabel?: string;
  ctaLink?: string;
  expanded?: boolean;
  slug?: string;
  large?: boolean;
  showOnNextLogin?: boolean;
  published?: boolean;
}

async function checkAuth(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.email) return false;
  return getDevEmails().has(session.user.email.toLowerCase());
}

export async function GET() {
  if (!(await checkAuth())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("changelog_posts")
    .select("id, version, title, body, image_url, published, created_at, category, type, content, image, cta, expanded, slug, large, show_on_next_login")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const entries: ChangelogEntry[] = (data ?? []).map((row) => {
    const ctaObj = row.cta as { text?: string; url?: string } | null;
    return {
      id: row.id as string,
      date: row.created_at as string,
      version: row.version as string,
      title: row.title as string,
      description: (row.body as string) ?? "",
      category: (row.category as string | null) ?? undefined,
      type: (row.type as "update" | "post" | null) ?? undefined,
      content: (row.content as string | null) ?? undefined,
      image: (row.image as string | null) ?? undefined,
      imageUrl: (row.image_url as string | null) ?? undefined,
      cta: ctaObj ? { text: ctaObj.text ?? "", url: ctaObj.url ?? "" } : undefined,
      ctaLabel: ctaObj?.text ?? undefined,
      ctaLink: ctaObj?.url ?? undefined,
      expanded: (row.expanded as boolean | null) ?? false,
      slug: (row.slug as string | null) ?? undefined,
      large: (row.large as boolean | null) ?? false,
      showOnNextLogin: (row.show_on_next_login as boolean | null) ?? false,
      published: (row.published as boolean | null) ?? false,
    };
  });

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const entry: ChangelogEntry = await req.json();
  if (!entry.version?.trim() || !entry.title?.trim()) {
    return NextResponse.json({ error: "version and title are required" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("changelog_posts")
    .select("version")
    .eq("version", entry.version.trim())
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: `Version ${entry.version} already exists` }, { status: 409 });
  }

  const cta =
    entry.ctaLabel && entry.ctaLink
      ? { text: entry.ctaLabel, url: entry.ctaLink }
      : entry.cta ?? null;

  const { error } = await supabaseAdmin.from("changelog_posts").insert({
    version: entry.version.trim(),
    title: entry.title.trim(),
    body: entry.description ?? "",
    image_url: entry.imageUrl || null,
    category: entry.category || null,
    type: entry.type || "update",
    content: entry.content || null,
    image: entry.image || null,
    cta: cta || null,
    expanded: entry.expanded ?? false,
    slug: entry.slug || null,
    large: entry.large ?? false,
    show_on_next_login: entry.showOnNextLogin ?? false,
    published: entry.published ?? true,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const entry: ChangelogEntry = await req.json();
  if (!entry.version?.trim()) {
    return NextResponse.json({ error: "version is required" }, { status: 400 });
  }

  const cta =
    entry.ctaLabel && entry.ctaLink
      ? { text: entry.ctaLabel, url: entry.ctaLink }
      : entry.cta ?? null;

  const { error } = await supabaseAdmin
    .from("changelog_posts")
    .update({
      title: entry.title.trim(),
      body: entry.description ?? "",
      image_url: entry.imageUrl || null,
      category: entry.category || null,
      type: entry.type || "update",
      content: entry.content || null,
      image: entry.image || null,
      cta: cta || null,
      expanded: entry.expanded ?? false,
      slug: entry.slug || null,
      large: entry.large ?? false,
      show_on_next_login: entry.showOnNextLogin ?? false,
      published: entry.published ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("version", entry.version.trim());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { version } = await req.json();
  if (!version) return NextResponse.json({ error: "version is required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("changelog_posts")
    .delete()
    .eq("version", version);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
