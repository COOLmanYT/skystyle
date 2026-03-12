"use client";

import { useCallback, useEffect, useState } from "react";

interface PageSpacingWrapperProps {
  page: "dashboard" | "account" | "settings";
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Reads the extra-side-spacing preference from localStorage and applies
 * extra horizontal padding when the current page is in the enabled list.
 * Uses a lazy state initializer so it reads localStorage exactly once on
 * mount without triggering a cascading setState-in-effect lint warning.
 */
export default function PageSpacingWrapper({
  page,
  className = "",
  style,
  children,
}: PageSpacingWrapperProps) {
  const readExtraPx = useCallback(() => {
    if (typeof window === "undefined") return 0;
    try {
      const enabled = localStorage.getItem("skystyle_extra_spacing") === "true";
      const pages = (localStorage.getItem("skystyle_extra_spacing_pages") ?? "dashboard")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      return enabled && pages.includes(page) ? 32 : 0;
    } catch {
      return 0;
    }
  }, [page]);

  const [extraPx, setExtraPx] = useState<number>(() => readExtraPx());

  useEffect(() => {
    const syncExtraSpacing = () => setExtraPx(readExtraPx());

    syncExtraSpacing();
    window.addEventListener("storage", syncExtraSpacing);
    window.addEventListener("skystyle-preferences-updated", syncExtraSpacing);
    return () => {
      window.removeEventListener("storage", syncExtraSpacing);
      window.removeEventListener("skystyle-preferences-updated", syncExtraSpacing);
    };
  }, [readExtraPx]);

  return (
    <div
      className={className}
      style={{ ...style, paddingLeft: extraPx || undefined, paddingRight: extraPx || undefined }}
    >
      {children}
    </div>
  );
}
