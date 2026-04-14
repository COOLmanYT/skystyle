"use client";

import { useEffect } from "react";

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

    const id = "closet-item-" + highlight.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const el = document.getElementById(id);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    el.style.transition = "box-shadow 0.2s ease, border-color 0.2s ease";
    el.style.boxShadow = "0 0 0 3px var(--accent)";
    el.style.borderColor = "var(--accent)";

    const timer = setTimeout(() => {
      el.style.boxShadow = "";
      el.style.borderColor = "";
    }, 2500);

    return () => clearTimeout(timer);
  }, [highlight]);

  return null;
}
