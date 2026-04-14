"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import MarkdownRenderer from "@/components/MarkdownRenderer";

export interface ChangelogModalEntry {
  version: string;
  title: string;
  description?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaLink?: string;
  /** Full Markdown content for large-changelog entries */
  content?: string;
}

interface Props {
  entry: ChangelogModalEntry;
  onClose: () => void;
  /** When true, shows a "View full changelog" link */
  showChangelogLink?: boolean;
}

export default function ChangelogModal({ entry, onClose, showChangelogLink }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="changelog-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full max-w-lg rounded-3xl outline-none overflow-hidden"
        style={{
          background: "var(--card)",
          border: "1px solid var(--card-border)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header image */}
        {entry.imageUrl && (
          <div
            style={{
              width: "100%",
              height: 160,
              backgroundImage: `url(${entry.imageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              flexShrink: 0,
            }}
            aria-hidden="true"
          />
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <span
              className="text-xs font-mono px-2 py-0.5 rounded-lg"
              style={{
                background: "var(--background)",
                color: "var(--foreground)",
                border: "1px solid var(--card-border)",
              }}
            >
              v{entry.version}
            </span>
          </div>

          {/* Title */}
          <h2
            id="changelog-modal-title"
            className="text-xl font-bold"
            style={{ color: "var(--foreground)" }}
          >
            {entry.title}
          </h2>

          {/* Short description */}
          {entry.description && (
            <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)", opacity: 0.7 }}>
              {entry.description}
            </p>
          )}

          {/* Full Markdown content */}
          {entry.content && (
            <MarkdownRenderer
              content={entry.content}
              className="text-sm leading-relaxed"
              style={{ color: "var(--foreground)" }}
            />
          )}

          {/* CTA button */}
          {entry.ctaLabel && entry.ctaLink && (
            <div className="pt-1">
              <a
                href={entry.ctaLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-xl px-5 py-2.5 text-sm font-medium btn-interact"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {entry.ctaLabel}
              </a>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium btn-interact"
              style={{
                background: "var(--background)",
                color: "var(--foreground)",
                border: "1px solid var(--card-border)",
              }}
            >
              Close
            </button>
            {showChangelogLink && (
              <Link
                href="/changelog"
                onClick={onClose}
                className="text-xs btn-interact rounded-lg px-3 py-2 inline-block"
                style={{ color: "var(--accent)" }}
              >
                View full changelog →
              </Link>
            )}
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full w-7 h-7 flex items-center justify-center text-sm btn-interact"
          style={{
            background: "var(--background)",
            color: "var(--foreground)",
            border: "1px solid var(--card-border)",
          }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
