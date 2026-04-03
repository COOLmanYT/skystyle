"use client";

import { useEffect, useRef } from "react";

interface Props {
  onClose: () => void;
}

export default function UpgradePlanModal({ onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Trap focus & prevent body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => { document.body.style.overflow = prev; };
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
        className="relative w-full max-w-sm rounded-3xl p-7 space-y-5 outline-none"
        style={{
          background: "var(--card)",
          border: "1px solid var(--card-border)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
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

        {/* Icon */}
        <div className="text-4xl text-center" aria-hidden="true">☕</div>

        {/* Heading */}
        <h2
          id="upgrade-modal-title"
          className="text-lg font-semibold text-center"
          style={{ color: "var(--foreground)" }}
        >
          Pro plans coming soon
        </h2>

        {/* Body */}
        <p className="text-sm text-center leading-relaxed" style={{ color: "var(--foreground)", opacity: 0.65 }}>
          We&apos;re still setting up secure payment processing with Stripe — paid plans aren&apos;t
          available yet. Sky Style is currently{" "}<strong>free</strong>{" "}while we&apos;re in our
          Proof of Concept phase.
        </p>
        <p className="text-sm text-center leading-relaxed" style={{ color: "var(--foreground)", opacity: 0.65 }}>
          If you&apos;d like to support server costs and help keep the project running, you can
          donate voluntarily via Buy Me a Coffee — no obligation, no perks, just gratitude. ❤️
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <a
            href="https://buymeacoffee.com/coolmanyt"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center rounded-xl px-4 py-3 text-sm font-medium btn-interact"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            ☕ Support via Donation
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
