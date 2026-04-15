import { notFound } from "next/navigation";
import Link from "next/link";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import SmartBackButton from "@/components/SmartBackButton";
import { supabaseAdmin } from "@/lib/supabase";

interface ChangelogCta {
  text: string;
  url: string;
}

interface ChangelogEntry {
  date: string;
  version: string;
  title: string;
  description: string;
  category?: string;
  type?: "update" | "post";
  content?: string;
  image?: string;
  cta?: ChangelogCta;
  expanded?: boolean;
  slug?: string;
}

async function getEntry(slug: string): Promise<ChangelogEntry | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("changelog_posts")
      .select("version, title, body, image_url, published, created_at, category, type, content, image, cta, expanded, slug")
      .eq("slug", slug)
      .eq("published", true)
      .single();

    if (!error && data) {
      return {
        date: data.created_at as string,
        version: data.version as string,
        title: data.title as string,
        description: (data.body as string | null) ?? "",
        category: data.category as string | undefined,
        type: data.type as "update" | "post" | undefined,
        content: (data.content as string | null) ?? undefined,
        image: (data.image as string | null) ?? (data.image_url as string | null) ?? undefined,
        cta: data.cta as ChangelogCta | undefined,
        expanded: (data.expanded as boolean | null) ?? false,
        slug: data.slug as string,
      };
    }
  } catch {
    /* Supabase unavailable */
  }

  return null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function ChangelogEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = await getEntry(slug);
  if (!entry) notFound();

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <nav
        className="sticky top-0 z-10 px-4 py-3"
        style={{ borderBottom: "1px solid var(--card-border)", background: "var(--background)" }}
      >
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <SmartBackButton fallback="/changelog" label="← Changelog" />
          <span className="text-sm font-semibold" style={{ color: "var(--foreground)", opacity: 0.6 }}>
            📋 Changelog
          </span>
        </div>
      </nav>

      <article className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        {/* Header image */}
        {entry.image && (
          <div
            className="w-full rounded-2xl overflow-hidden"
            style={{ height: 240, backgroundImage: `url(${entry.image})`, backgroundSize: "cover", backgroundPosition: "center" }}
            aria-hidden="true"
          />
        )}

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-xs font-mono px-2 py-0.5 rounded-lg"
            style={{ background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--card-border)" }}
          >
            v{entry.version}
          </span>
          {entry.category && (
            <span
              className="text-xs px-2 py-0.5 rounded-lg font-medium"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {entry.category}
            </span>
          )}
          <span className="text-xs" style={{ color: "var(--foreground)", opacity: 0.45 }}>
            {formatDate(entry.date)}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
          {entry.title}
        </h1>

        {/* Short description */}
        {entry.description && (
          <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)", opacity: 0.65 }}>
            {entry.description}
          </p>
        )}

        {/* Markdown content */}
        {entry.content && (
          <MarkdownRenderer
            content={entry.content}
            className="text-sm leading-relaxed space-y-3"
            style={{ color: "var(--foreground)" }}
          />
        )}

        {/* CTA */}
        {entry.cta && (
          <div className="pt-2">
            <a
              href={entry.cta.url}
              className="inline-block rounded-xl px-5 py-2.5 text-sm font-medium btn-interact"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {entry.cta.text}
            </a>
          </div>
        )}

        <div className="pt-4">
          <Link
            href="/changelog"
            className="text-xs btn-interact rounded-xl px-3 py-2 inline-block"
            style={{ color: "var(--foreground)", opacity: 0.5 }}
          >
            ← All updates
          </Link>
        </div>
      </article>
    </div>
  );
}
