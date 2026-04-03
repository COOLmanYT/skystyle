"use client";

import { useState, useEffect } from "react";
import { submitFeedback } from "@/app/actions";

const CATEGORIES = [
  { value: "Bug", label: "🐛 Bug" },
  { value: "Style", label: "👗 Style" },
  { value: "Weather", label: "🌦️ Weather" },
  { value: "UI/UX", label: "🎨 UI/UX" },
  { value: "Other", label: "✨ Other" },
];

function getLocalStorage(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

interface FeedbackFormProps {
  isPro?: boolean;
  isDev?: boolean;
  initialCategory?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function FeedbackForm({
  isPro,
  isDev,
  initialCategory,
  onSuccess,
  onCancel,
}: FeedbackFormProps) {
  const [simpleMode, setSimpleMode] = useState(true);
  const [category, setCategory] = useState(initialCategory ?? "Other");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSimpleMode(getLocalStorage("skystyle_simple_mode", "true") === "true");
  }, []);

  const planBtnClass = isDev
    ? "btn-plan-dev"
    : isPro
    ? "btn-plan-pro"
    : "btn-plan-free";

  const planFocusClass = isDev
    ? "focus-plan-dev"
    : isPro
    ? "focus-plan-pro"
    : "focus-plan-free";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Please select a rating.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await submitFeedback({ category, rating, comment });
    setSubmitting(false);
    if (result.success) {
      setSuccess(true);
      if (onSuccess) setTimeout(onSuccess, 2000);
    } else {
      setError(result.error ?? "Something went wrong. Please try again.");
    }
  }

  if (success) {
    return (
      <div
        className="rounded-2xl p-6 text-center space-y-2"
        role="status"
        aria-live="polite"
        style={{ background: "#34c75915", border: "1px solid #34c75940" }}
      >
        <p className="text-2xl" aria-hidden="true">
          💚
        </p>
        <p className="text-sm font-semibold" style={{ color: "#34c759" }}>
          {simpleMode
            ? "Thank you! Your feedback helps us build a better Sky Style."
            : "Feedback received. You're filled with determination."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Category */}
      <div className="space-y-2">
        <p
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--foreground)", opacity: 0.5 }}
        >
          {simpleMode ? "What happened?" : "Category"}
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategory(cat.value)}
              aria-pressed={category === cat.value}
              className={`rounded-xl px-3 py-1.5 text-xs btn-interact ${planFocusClass}`}
              style={{
                background:
                  category === cat.value ? "var(--accent)" : "var(--background)",
                color: category === cat.value ? "#fff" : "var(--foreground)",
                border: `1px solid ${
                  category === cat.value ? "var(--accent)" : "var(--card-border)"
                }`,
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rating */}
      <div className="space-y-2">
        <p
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--foreground)", opacity: 0.5 }}
        >
          Rating
        </p>
        <div className="flex gap-2" role="group" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              aria-label={`${star} star${star > 1 ? "s" : ""}`}
              aria-pressed={rating === star}
              className={`text-xl btn-interact rounded-lg p-1 ${planFocusClass}`}
              style={{ opacity: rating >= star ? 1 : 0.3 }}
            >
              ⭐
            </button>
          ))}
        </div>
      </div>

      {/* Comment */}
      <div className="space-y-2">
        <label
          htmlFor="feedback-comment"
          className="block text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--foreground)", opacity: 0.5 }}
        >
          {simpleMode ? "Tell me more" : "Comment"}
        </label>
        <textarea
          id="feedback-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder={
            simpleMode
              ? "Anything else you'd like to share…"
              : "Optional — share any details"
          }
          className={`w-full rounded-xl px-4 py-3 text-sm outline-none resize-none ${planFocusClass}`}
          style={{
            background: "var(--background)",
            color: "var(--foreground)",
            border: "1px solid var(--card-border)",
          }}
        />
      </div>

      {error && (
        <p role="alert" className="text-xs" style={{ color: "#ff3b30" }}>
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold btn-interact disabled:opacity-40 ${planBtnClass}`}
        >
          {submitting ? "Sending…" : "Submit"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2.5 text-sm btn-interact"
            style={{
              background: "var(--background)",
              color: "var(--foreground)",
              border: "1px solid var(--card-border)",
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
