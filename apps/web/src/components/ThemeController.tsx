"use client";

import { useEffect } from "react";

function applyTheme() {
  const root = document.documentElement;
  let mode = "system";
  try {
    mode = localStorage.getItem("skystyle_theme_mode") ?? "system";
  } catch {
    mode = "system";
  }

  if (mode === "light" || mode === "dark") {
    root.setAttribute("data-theme", mode);
  } else {
    root.removeAttribute("data-theme");
  }
}

export default function ThemeController() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleUpdate = () => applyTheme();
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === "skystyle_theme_mode") {
        applyTheme();
      }
    };

    applyTheme();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("skystyle-preferences-updated", handleUpdate);
    media.addEventListener("change", handleUpdate);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("skystyle-preferences-updated", handleUpdate);
      media.removeEventListener("change", handleUpdate);
    };
  }, []);

  return null;
}
