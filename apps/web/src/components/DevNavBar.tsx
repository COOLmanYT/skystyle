"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { handleSignOut } from "@/app/actions";

interface DevNavBarProps {
  email: string;
}

const NAV_ITEMS = [
  { label: "🏠 Dashboard", href: "/dashboard" },
  { label: "👤 Account", href: "/account" },
  { label: "⚙️ Settings", href: "/settings" },
  { label: "🛠️ Dev Center", href: "/dev" },
];

/**
 * Hamburger-style navigation bar for dev pages.
 * Provides lateral navigation without requiring a "back" button.
 */
export default function DevNavBar({ email }: DevNavBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      <nav
        className="sticky-nav px-4 py-3"
        style={{ borderBottom: "1px solid var(--card-border)" }}
      >
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-xl btn-interact"
              style={{ color: "var(--foreground)" }}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              aria-controls="dev-nav-menu"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="5" x2="17" y2="5" />
                <line x1="3" y1="10" x2="17" y2="10" />
                <line x1="3" y1="15" x2="17" y2="15" />
              </svg>
            </button>
            <span className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              🛠️ Dev Center
            </span>
          </div>
          <span
            className="text-xs font-medium px-2 py-1 rounded-full"
            style={{ background: "#ff9500", color: "#fff" }}
          >
            {email}
          </span>
        </div>
      </nav>

      {/* Hamburger overlay */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            id="dev-nav-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="fixed top-0 left-0 h-full w-64 z-50 p-6 space-y-4 overflow-y-auto"
            style={{ background: "var(--card)", borderRight: "1px solid var(--card-border)" }}
            onKeyDown={(e) => { if (e.key === "Escape") setMenuOpen(false); }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                <span aria-hidden="true">🌤️ </span>Sky Style
              </span>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-1 rounded-lg btn-interact"
                style={{ color: "var(--foreground)" }}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            <nav className="space-y-1" aria-label="Menu navigation">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <button
                    key={item.href}
                    onClick={() => { setMenuOpen(false); router.push(item.href); }}
                    className="w-full text-left rounded-xl px-3 py-2.5 text-sm btn-interact"
                    style={{
                      color: isActive ? "#fff" : "var(--foreground)",
                      background: isActive ? "#007AFF" : "transparent",
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
              <form action={handleSignOut}>
                <button
                  type="submit"
                  className="w-full text-left rounded-xl px-3 py-2.5 text-sm btn-interact"
                  style={{ color: "#ff3b30" }}
                >
                  🚪 Sign Out
                </button>
              </form>
            </nav>

            <hr style={{ borderColor: "var(--card-border)" }} />
            <div className="space-y-1">
              <Link
                href="/changelog"
                className="block rounded-xl px-3 py-2 text-xs btn-interact"
                style={{ color: "var(--foreground)", opacity: 0.6 }}
                onClick={() => setMenuOpen(false)}
              >
                📋 Changelog
              </Link>
              <Link
                href="/"
                className="block rounded-xl px-3 py-2 text-xs btn-interact"
                style={{ color: "var(--foreground)", opacity: 0.6 }}
                onClick={() => setMenuOpen(false)}
              >
                ← Main Page
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}
