"use client";

import { useEffect } from "react";
import { closetItemId } from "@/lib/recommendation-links";

interface Props {
  /** The item name to scroll to and highlight, or null/undefined if nothing */
  highlight: string | null | undefined;
}

/**
 * Reads the `highlight` prop, scrolls to the matching closet item,
 * and applies a temporary glow for ~2.5 s.
 */
export default function ClosetHighlighter({ highlight }: Props) {
  useEffect(() => {
    if (!highlight) return;

    const id = closetItemId(highlight);
    const el = document.getElementById(id);
    if (!el) return;

    el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    el.focus({ preventScroll: true });

    el.style.transition = "box-shadow 0.2s ease, border-color 0.2s ease";
    el.style.boxShadow = "0 0 0 3px var(--accent)";
    el.style.borderColor = "var(--accent)";

    const restore = () => {
      el.style.transition = "";
      el.style.boxShadow = "";
      el.style.borderColor = "";
    };
    const timer = setTimeout(restore, 2500);

    return () => { clearTimeout(timer); restore(); };
  }, [highlight]);

  return null;
}
