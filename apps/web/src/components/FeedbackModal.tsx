"use client";

import { useEffect } from "react";
import FeedbackForm from "./FeedbackForm";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPro?: boolean;
  isDev?: boolean;
  initialCategory?: string;
}

export default function FeedbackModal({
  isOpen,
  onClose,
  isPro,
  isDev,
  initialCategory,
}: FeedbackModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Share Feedback"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        aria-hidden="true"
      />

      <div
        className="relative w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            Share Feedback
          </h2>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-sm btn-interact"
            style={{ color: "var(--foreground)", opacity: 0.5 }}
            aria-label="Close feedback dialog"
          >
            ✕
          </button>
        </div>

        <FeedbackForm
          isPro={isPro}
          isDev={isDev}
          initialCategory={initialCategory}
          onSuccess={onClose}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
