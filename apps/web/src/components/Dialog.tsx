"use client";
import { useEffect, useRef, type ReactNode } from "react";
export default function Dialog({ title, onClose, children, decoration, spotlight = false }: {
  title: string; onClose: () => void; children: ReactNode; decoration?: ReactNode; spotlight?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = panel.current;
    root?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab" || !root) return;
      const items = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')]
        .filter((item) => item.getClientRects().length > 0);
      const first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); root.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root)) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, []);
  return <div className={`fixed inset-0 z-[80] flex p-4 ${spotlight ? "items-end justify-end" : "items-end justify-center sm:items-center"}`} role="dialog" aria-modal="true" aria-label={title}>
    <div className={`absolute inset-0 ${spotlight ? "" : "bg-black/55"}`} aria-hidden="true" />
    {decoration}
    <div ref={panel} tabIndex={-1} className={`relative max-h-[85dvh] w-full ${spotlight ? "sm:max-w-sm" : "max-w-lg"} overflow-y-auto rounded-3xl border p-5 shadow-2xl outline-none sm:p-6`}
      style={{ background: "var(--card)", color: "var(--foreground)", borderColor: "var(--card-border)" }}>{children}</div>
  </div>;
}
