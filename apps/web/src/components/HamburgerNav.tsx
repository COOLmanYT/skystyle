"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type NavPage = "dashboard" | "closet" | "account" | "settings" | "feedback" | "other";

interface HamburgerNavProps {
  currentPage: NavPage;
  userName?: string;
  /** Page title shown in the nav bar */
  title?: string;
  /** Optional click handler for the title text (e.g. scroll-to-top on Dashboard) */
  onTitleClick?: () => void;
  /** Extra content rendered on the right side of the nav bar */
  rightContent?: React.ReactNode;
  /** Server action called when Sign Out is pressed. Omit to hide Sign Out. */
  signOutAction?: () => Promise<void>;
  /** Show the Dev Dashboard link in the menu */
  isDev?: boolean;
  /** Show an unread indicator on the Changelog link */
  changelogUnread?: boolean;
  /** Called when the Changelog link is clicked (e.g. to clear the unread state) */
  onChangelogClick?: () => void;
}

export default function HamburgerNav({
  currentPage,
  userName,
  title,
  onTitleClick,
  rightContent,
  signOutAction,
  isDev,
  changelogUnread,
  onChangelogClick,
}: HamburgerNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [homeExpanded, setHomeExpanded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // Close menu on Escape
  useEffect(() => {
    if (!menuOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  const isActive = (page: NavPage) => page === currentPage;
  // "Home" row is active when on the dashboard page
  const isHomeActive = currentPage === "dashboard";

  function navItemStyle(page: NavPage): React.CSSProperties {
    return {
      color: isActive(page) ? "#fff" : "var(--foreground)",
      background: isActive(page) ? "#007AFF" : "transparent",
    };
  }

  return (
    <>
      {/* ── Nav Bar ── */}
      <nav
        className="sticky-nav px-4 py-3"
        style={{ borderBottom: "1px solid var(--card-border)" }}
        aria-label="Page navigation"
      >
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            {/* Hamburger button */}
            <button
              onClick={() => setMenuOpen(true)}
              className="p-2 rounded-xl btn-interact"
              style={{ color: "var(--foreground)" }}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="3" y1="5" x2="17" y2="5" />
                <line x1="3" y1="10" x2="17" y2="10" />
                <line x1="3" y1="15" x2="17" y2="15" />
              </svg>
            </button>

            {title && (
              onTitleClick ? (
                <button
                  onClick={onTitleClick}
                  className="btn-interact text-lg font-semibold cursor-pointer"
                  style={{ color: "var(--foreground)" }}
                >
                  {title}
                </button>
              ) : (
                <span
                  className="text-lg font-semibold"
                  style={{ color: "var(--foreground)" }}
                >
                  {title}
                </span>
              )
            )}
          </div>

          {rightContent && (
            <div className="flex items-center gap-2">{rightContent}</div>
          )}
        </div>
      </nav>

      {/* ── Overlay + Drawer ── */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0"
            style={{ background: "rgba(0,0,0,0.4)", zIndex: 40 }}
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer */}
          <div
            ref={menuRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="fixed top-0 left-0 h-full w-72 flex flex-col p-5 overflow-y-auto"
            style={{
              background: "var(--card)",
              borderRight: "1px solid var(--card-border)",
              zIndex: 50,
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setMenuOpen(false);
            }}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between mb-5">
              <span
                className="text-lg font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                🌤️ Sky Style
                {userName && (
                  <span
                    className="text-sm font-normal ml-2"
                    style={{ opacity: 0.5 }}
                  >
                    {userName}
                  </span>
                )}
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

            {/* Navigation items */}
            <nav className="space-y-1 flex-1" aria-label="Menu navigation">
              {/* 🏠 Home (expandable) */}
              <div>
                <button
                  onClick={() => setHomeExpanded((v) => !v)}
                  className="w-full text-left rounded-xl px-3 py-2.5 text-sm btn-interact flex items-center justify-between"
                  style={{
                    color: isHomeActive ? "#fff" : "var(--foreground)",
                    background: isHomeActive ? "#007AFF" : "transparent",
                  }}
                >
                  <span>🏠 Home</span>
                  <span style={{ opacity: isHomeActive ? 0.8 : 0.5, fontSize: 11 }}>
                    {homeExpanded ? "▲" : "▼"}
                  </span>
                </button>
                {homeExpanded && (
                  <div className="pl-4 mt-1 space-y-0.5">
                    <Link
                      href="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-xl px-3 py-2 text-sm btn-interact"
                      style={{ color: "var(--foreground)", opacity: 0.8 }}
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/closet"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-xl px-3 py-2 text-sm btn-interact"
                      style={navItemStyle("closet")}
                    >
                      👕 Closet
                    </Link>
                  </div>
                )}
              </div>

              {/* Account */}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/account");
                }}
                className="w-full text-left rounded-xl px-3 py-2.5 text-sm btn-interact"
                style={navItemStyle("account")}
              >
                👤 Account
              </button>

              {/* Settings */}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/settings");
                }}
                className="w-full text-left rounded-xl px-3 py-2.5 text-sm btn-interact"
                style={navItemStyle("settings")}
              >
                ⚙️ Settings
              </button>

              {/* Feedback */}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/feedback");
                }}
                className="w-full text-left rounded-xl px-3 py-2.5 text-sm btn-interact"
                style={navItemStyle("feedback")}
              >
                💬 Feedback
              </button>

              {/* Dev Dashboard (only for dev users) */}
              {isDev && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/dev");
                  }}
                  className="w-full text-left rounded-xl px-3 py-2.5 text-sm btn-interact"
                  style={{ color: "var(--foreground)" }}
                >
                  🛠️ Dev Dashboard
                </button>
              )}

              {/* Sign Out (only when a sign-out action is provided) */}
              {signOutAction && (
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="w-full text-left rounded-xl px-3 py-2.5 text-sm btn-interact"
                    style={{ color: "#ff3b30" }}
                  >
                    🚪 Sign Out
                  </button>
                </form>
              )}
            </nav>

            <hr style={{ borderColor: "var(--card-border)", margin: "12px 0" }} />

            <div className="space-y-1">
              <Link
                href="/changelog"
                onClick={() => {
                  setMenuOpen(false);
                  onChangelogClick?.();
                }}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs btn-interact"
                style={{ color: "var(--foreground)", opacity: 0.6 }}
              >
                📋 Changelog
                {changelogUnread && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#ff3b30",
                      flexShrink: 0,
                    }}
                    aria-label="Unread changelog updates"
                  />
                )}
              </Link>
              <Link
                href="/"
                onClick={() => setMenuOpen(false)}
                className="block rounded-xl px-3 py-2 text-xs btn-interact"
                style={{ color: "var(--foreground)", opacity: 0.6 }}
              >
                ← Main Page
              </Link>
              <Link
                href="/terms"
                onClick={() => setMenuOpen(false)}
                className="block rounded-xl px-3 py-2 text-xs btn-interact"
                style={{ color: "var(--foreground)", opacity: 0.6 }}
              >
                Terms of Service
              </Link>
              <Link
                href="/privacy"
                onClick={() => setMenuOpen(false)}
                className="block rounded-xl px-3 py-2 text-xs btn-interact"
                style={{ color: "var(--foreground)", opacity: 0.6 }}
              >
                Privacy Policy
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}
