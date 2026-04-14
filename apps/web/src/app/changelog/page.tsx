"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SmartBackButton from "@/components/SmartBackButton";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import ChangelogModal, { type ChangelogModalEntry } from "@/components/ChangelogModal";

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
  /** Legacy image URL field from dev CMS */
  imageUrl?: string;
  cta?: ChangelogCta;
  /** Legacy CTA fields from dev CMS */
  ctaLabel?: string;
  ctaLink?: string;
  expanded?: boolean;
  slug?: string;
  /** When true, clicking the entry opens it in a modal popup */
  large?: boolean;
  showOnNextLogin?: boolean;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);
  const diffWeek = Math.round(diffDay / 7);
  const diffMonth = Math.round(diffDay / 30);
  const diffYear = Math.round(diffDay / 365);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (diffSec < 60) return rtf.format(-diffSec, "second");
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  if (diffHour < 24) return rtf.format(-diffHour, "hour");
  if (diffDay < 7) return rtf.format(-diffDay, "day");
  if (diffWeek < 4) return rtf.format(-diffWeek, "week");
  if (diffMonth < 12) return rtf.format(-diffMonth, "month");
  return rtf.format(-diffYear, "year");
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/changelog")
      .then((r) => r.json())
      .then((data: ChangelogEntry[]) => {
        setEntries(data);
        // Mark all changelog entries as seen
        if (data.length > 0) {
          try {
            localStorage.setItem("skystyle_last_seen_changelog", data[0].version);
          } catch { /* ignore */ }
        }
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-10 px-4 py-3"
        style={{ borderBottom: "1px solid var(--card-border)", background: "var(--background)" }}
      >
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <SmartBackButton fallback="/" />
          <span className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            📋 Changelog
          </span>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          What&apos;s New
        </h1>
        <p className="text-sm mb-10" style={{ color: "var(--foreground)", opacity: 0.5 }}>
          All updates to Sky Style, newest first.
        </p>

        {loading ? (
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl p-5 animate-pulse"
                style={{ background: "var(--card)", border: "1px solid var(--card-border)", height: 100 }}
              />
            ))}
          </div>
        ) : (
          <ChangelogTimeline entries={entries} />
        )}
      </div>
    </div>
  );
}

export function ChangelogTimeline({ entries, limit }: { entries: ChangelogEntry[]; limit?: number }) {
  const shown = limit ? entries.slice(0, limit) : entries;
  const [modalEntry, setModalEntry] = useState<ChangelogModalEntry | null>(null);

  function toModalEntry(entry: ChangelogEntry): ChangelogModalEntry {
    return {
      version: entry.version,
      title: entry.title,
      description: entry.description,
      imageUrl: entry.imageUrl ?? entry.image,
      ctaLabel: entry.ctaLabel ?? entry.cta?.text,
      ctaLink: entry.ctaLink ?? entry.cta?.url,
      content: entry.content,
    };
  }

  return (
    <div className="relative">
      {/* Changelog entry modal */}
      {modalEntry && (
        <ChangelogModal
          entry={modalEntry}
          onClose={() => setModalEntry(null)}
          showChangelogLink={false}
        />
      )}

      {/* Vertical line */}
      <div
        className="absolute left-[7px] top-3"
        style={{
          width: 2,
          bottom: 8,
          background: "var(--card-border)",
          imageRendering: "crisp-edges",
          willChange: "auto",
        }}
        aria-hidden="true"
      />

      <div className="space-y-8">
        {shown.map((entry, i) => (
          <div key={entry.version} className="relative flex gap-5">
            {/* Dot node */}
            <div
              className="relative z-10 mt-1 flex-shrink-0"
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: i === 0 ? "var(--accent)" : "var(--card-border)",
                border: `2px solid ${i === 0 ? "var(--accent)" : "var(--card-border)"}`,
                boxShadow: i === 0 ? "0 0 0 3px var(--background), 0 0 0 5px var(--accent)" : "0 0 0 3px var(--background)",
                outline: "none",
              }}
              aria-hidden="true"
            />

            {/* Content */}
            <div
              className="flex-1 rounded-2xl overflow-hidden"
              style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
            >
              {/* Header image */}
              {(entry.image ?? entry.imageUrl) && (
                <div
                  className="w-full"
                  style={{ height: 160, backgroundImage: `url(${entry.image ?? entry.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
                  aria-hidden="true"
                />
              )}

              <div className="p-4 space-y-2">
                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded-lg"
                    style={{ background: "var(--background)", color: "var(--foreground)", opacity: 0.7 }}
                  >
                    v{entry.version}
                  </span>
                  {entry.category && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-lg font-medium"
                      style={{ background: "var(--accent)", color: "#fff", opacity: 0.85 }}
                    >
                      {entry.category}
                    </span>
                  )}
                  {entry.large && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-lg font-medium"
                      style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--card-border)", opacity: 0.7 }}
                    >
                      📰 Full Post
                    </span>
                  )}
                  <span className="text-xs" style={{ color: "var(--foreground)", opacity: 0.45 }}>
                    {formatDate(entry.date)} · {formatRelativeTime(entry.date)}
                  </span>
                </div>

                {/* Title */}
                <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  {entry.title}
                </p>

                {/* Description */}
                {entry.description && (
                  <p className="text-xs leading-relaxed" style={{ color: "var(--foreground)", opacity: 0.65 }}>
                    {entry.description}
                  </p>
                )}

                {/* Extended Markdown content (inline, for non-large entries) */}
                {entry.content && !entry.large && (
                  <MarkdownRenderer
                    content={entry.content}
                    className="text-xs leading-relaxed mt-2"
                    style={{ color: "var(--foreground)", opacity: 0.75 }}
                  />
                )}

                {/* CTA button (non-large entries) */}
                {!entry.large && (entry.cta ?? (entry.ctaLabel && entry.ctaLink)) && (
                  <div className="pt-1">
                    <a
                      href={entry.cta?.url ?? entry.ctaLink ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block rounded-xl px-4 py-2 text-xs font-medium btn-interact"
                      style={{ background: "var(--accent)", color: "#fff" }}
                    >
                      {entry.cta?.text ?? entry.ctaLabel}
                    </a>
                  </div>
                )}

                {/* Large entry: "Read more" opens modal */}
                {entry.large && (
                  <div className="pt-1">
                    <button
                      onClick={() => setModalEntry(toModalEntry(entry))}
                      className="text-xs btn-interact rounded-lg px-2 py-1 inline-block"
                      style={{ color: "var(--accent)" }}
                    >
                      Read more →
                    </button>
                  </div>
                )}

                {/* Expanded slug entries get a page link */}
                {entry.expanded && entry.slug && !entry.large && (
                  <div className="pt-1">
                    <Link
                      href={`/changelog/${entry.slug}`}
                      className="text-xs btn-interact rounded-lg px-2 py-1 inline-block"
                      style={{ color: "var(--accent)" }}
                    >
                      Read more →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
