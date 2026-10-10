"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

interface Props {
  onClose: () => void;
}

export default function UpgradePlanModal({ onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nodes = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]');
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Trap focus & prevent body scroll
  useEffect(() => {
    const previousFocus = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => { document.body.style.overflow = prev; if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus(); };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-3xl p-5 sm:p-7 space-y-5 outline-none"
        style={{
          background: "var(--card)",
          border: "1px solid var(--card-border)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full w-11 h-11 flex items-center justify-center text-sm btn-interact"
          style={{
            background: "var(--background)",
            color: "var(--foreground)",
            border: "1px solid var(--card-border)",
          }}
          aria-label="Close"
        >
          ✕
        </button>

        {/* Icon */}
        <div className="text-4xl text-center" aria-hidden="true">☕</div>

        {/* Heading */}
        <h2
          id="upgrade-modal-title"
          className="text-lg font-semibold text-center"
          style={{ color: "var(--foreground)" }}
        >
          Your plan options
        </h2>

        {/* Body */}
        <p className="text-sm text-center leading-relaxed" style={{ color: "var(--foreground)", opacity: 0.65 }}>
          Your account page shows the allowance available to you. Pro access is managed for your account; checkout and credit purchases are unavailable.
        </p>
        <p className="text-sm text-center leading-relaxed" style={{ color: "var(--foreground)", opacity: 0.65 }}>
          If you&apos;d like to support server costs and help keep the project running, you can
          donate voluntarily via Buy Me a Coffee — no obligation, no perks, just gratitude. ❤️
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <Link href="/pricing" className="control-button primary-button text-sm">Compare plans</Link>
          <a
            href="https://buymeacoffee.com/coolmanyt"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center rounded-xl px-4 py-3 text-sm font-medium btn-interact"
            style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--card-border)" }}
          >
            Support via donation
          </a>
          <button
            onClick={onClose}
            className="block w-full text-center rounded-xl px-4 py-3 text-sm font-medium btn-interact"
            style={{
              background: "var(--background)",
              color: "var(--foreground)",
              border: "1px solid var(--card-border)",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
