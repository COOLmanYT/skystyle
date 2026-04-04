"use client";

import { useRouter } from "next/navigation";

interface SmartBackButtonProps {
  /** Fallback href when there is no browser history (default: /dashboard) */
  fallback?: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A back button that calls router.back() when the user has history to go back to,
 * and falls back to `fallback` (default: /dashboard) otherwise.
 */
export default function SmartBackButton({
  fallback = "/dashboard",
  label = "← Back",
  className = "text-sm btn-interact rounded-xl px-3 py-2",
  style,
}: SmartBackButtonProps) {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return (
    <button
      onClick={handleBack}
      className={className}
      style={{ color: "var(--foreground)", opacity: 0.6, ...style }}
    >
      {label}
    </button>
  );
}
