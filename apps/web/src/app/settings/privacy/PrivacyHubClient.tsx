"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import HamburgerNav from "@/components/HamburgerNav";
import { handleSignOut } from "@/app/actions";

const EXPORT_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours
const EXPORT_COOLDOWN_KEY = "skystyle_export_cooldown_until";

/** Formats remaining milliseconds as "Xh Ym" or "Ym" */
function formatCooldown(remainingMs: number): string {
  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

interface PrivacyHubClientProps {
  isPendingDeletion: boolean;
  isDev?: boolean;
  /** When true, suppresses the full-page shell (nav + min-h-screen wrapper) for embedding inside another page. */
  embedded?: boolean;
}

export default function PrivacyHubClient({ isPendingDeletion: initialPending, isDev = false, embedded = false }: PrivacyHubClientProps) {
  const [isPendingDeletion, setIsPendingDeletion] = useState(initialPending);
  const [deletionReason, setDeletionReason] = useState("");
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Export cooldown: timestamp (ms) when cooldown expires, or null if not active
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  // Tick to force re-render of cooldown display every minute
  const [, setTick] = useState(0);
  // Hydration guard — avoid reading localStorage before client mount
  const [mounted, setMounted] = useState(false);

  // Load cooldown from localStorage on mount
  useEffect(() => {
    setMounted(true);
    if (isDev) return; // dev users have no cooldown
    try {
      const stored = localStorage.getItem(EXPORT_COOLDOWN_KEY);
      if (stored) {
        const until = parseInt(stored, 10);
        if (!isNaN(until) && until > Date.now()) {
          setCooldownUntil(until);
        } else {
          // Expired — clean up
          localStorage.removeItem(EXPORT_COOLDOWN_KEY);
        }
      }
    } catch { /* ignore */ }
  }, [isDev]);

  // Refresh the displayed countdown every 60 s; clear interval when cooldown expires
  useEffect(() => {
    if (!cooldownUntil) return;
    const id = setInterval(() => {
      if (Date.now() >= cooldownUntil) {
        setCooldownUntil(null);
        try { localStorage.removeItem(EXPORT_COOLDOWN_KEY); } catch { /* ignore */ }
      }
      setTick((t) => t + 1);
    }, 60_000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const cooldownRemaining = cooldownUntil ? Math.max(0, cooldownUntil - Date.now()) : 0;
  const isCoolingDown = mounted && !isDev && cooldownRemaining > 0;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  async function handleExport() {
    setDownloading(true);
    try {
      const res = await fetch("/api/privacy/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const filename = cd?.match(/filename="([^"]+)"/)?.[1] ?? "skystyle-export.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast("✅ Your data has been downloaded.");
      // Start cooldown for non-dev users
      if (!isDev) {
        const until = Date.now() + EXPORT_COOLDOWN_MS;
        setCooldownUntil(until);
        try { localStorage.setItem(EXPORT_COOLDOWN_KEY, String(until)); } catch { /* ignore */ }
      }
    } catch {
      showToast("❌ Export failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleRequestDeletion() {
    setLoading(true);
    const res = await fetch("/api/privacy/request-deletion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: deletionReason.trim() || null }),
    });
    setLoading(false);
    if (res.ok) {
      setIsPendingDeletion(true);
      setShowDeleteForm(false);
      showToast("Deletion request submitted. A developer will review it.");
    } else {
      showToast("Failed to submit request. Please try again.");
    }
  }

  async function handleCancelDeletion() {
    setLoading(true);
    const res = await fetch("/api/privacy/cancel-deletion", { method: "POST" });
    setLoading(false);
    if (res.ok) {
      setIsPendingDeletion(false);
      showToast("Deletion request cancelled.");
    } else {
      showToast("Failed to cancel. Please try again.");
    }
  }

  const content = (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Pending Deletion Banner */}
        {isPendingDeletion && (
          <div
            role="alert"
            className="rounded-2xl p-5 space-y-3"
            style={{ background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.2)" }}
          >
            <p className="text-sm font-semibold" style={{ color: "#ff3b30" }}>
              ⚠️ Your account is pending deletion
            </p>
            <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.7 }}>
              A developer will review and action your request. In the meantime, you can still use
              Sky Style or cancel the request below.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelDeletion}
                disabled={loading}
                className="text-xs rounded-xl px-4 py-2 font-semibold btn-interact"
                style={{ background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--card-border)" }}
              >
                ↩️ Cancel deletion request
              </button>
              <Link
                href="/feedback"
                className="text-xs rounded-xl px-4 py-2 btn-interact inline-block"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                💬 Message developer
              </Link>
            </div>
          </div>
        )}

        {/* Data Export */}
        <section
          className="rounded-2xl p-6 space-y-3"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>
            Data Export
          </p>
          <p className="text-sm" style={{ color: "var(--foreground)", opacity: 0.8 }}>
            Download everything we store about you — your profile, settings, closet, usage history, feedback, and security logs.
          </p>
          <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.5 }}>
            The file is a structured JSON export, human-readable and machine-parseable. It includes a version stamp and export timestamp.
          </p>
          <button
            onClick={handleExport}
            disabled={downloading}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold btn-interact"
            style={{ background: "var(--foreground)", color: "var(--background)" }}
          >
            {downloading ? "Preparing…" : "⬇️ Download My Data (.json)"}
          </button>
          {/* Cooldown notice — only shown after an export has been triggered */}
          {isCoolingDown && (
            <p
              className="text-xs"
              style={{ color: "var(--foreground)", opacity: 0.5 }}
              aria-live="polite"
            >
              ⏳ Next export available in {formatCooldown(cooldownRemaining)}
            </p>
          )}
        </section>

        {/* Account Deletion */}
        <section
          className="rounded-2xl p-6 space-y-3"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>
            Account Deletion
          </p>
          <p className="text-sm" style={{ color: "var(--foreground)", opacity: 0.8 }}>
            Request permanent deletion of your Sky Style account and all associated data.
          </p>
          <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.5 }}>
            This is a human-reviewed process. Your request is sent to a developer who will action it within 7 days. Until then, you can cancel at any time.
          </p>

          {!isPendingDeletion && !showDeleteForm && (
            <button
              onClick={() => setShowDeleteForm(true)}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold btn-interact"
              style={{ background: "rgba(255,59,48,0.1)", color: "#ff3b30", border: "1px solid rgba(255,59,48,0.2)" }}
            >
              🗑️ Request Account Deletion
            </button>
          )}

          {showDeleteForm && (
            <div className="space-y-3 pt-1">
              <textarea
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                placeholder="Reason for deletion (optional, helps us improve Sky Style)..."
                rows={3}
                maxLength={1000}
                className="w-full text-sm rounded-xl px-4 py-3 resize-none"
                style={{
                  background: "var(--background)",
                  color: "var(--foreground)",
                  border: "1px solid var(--card-border)",
                  outline: "none",
                }}
              />
              <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                {deletionReason.length}/1000
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleRequestDeletion}
                  disabled={loading}
                  className="rounded-xl px-5 py-2 text-sm font-semibold btn-interact"
                  style={{ background: "#ff3b30", color: "#fff" }}
                >
                  {loading ? "Submitting…" : "Submit Request"}
                </button>
                <button
                  onClick={() => setShowDeleteForm(false)}
                  className="rounded-xl px-5 py-2 text-sm btn-interact"
                  style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--card-border)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {isPendingDeletion && (
            <p className="text-xs" style={{ color: "#ff9500" }}>
              ⏳ A deletion request is already pending review.
            </p>
          )}
        </section>

        {/* Links */}
        <div className="flex items-center justify-center gap-4 text-xs" style={{ color: "var(--foreground)", opacity: 0.4 }}>
          <Link href="/privacy" className="underline hover:opacity-70">Privacy Policy</Link>
          <Link href="/terms" className="underline hover:opacity-70">Terms</Link>
          <Link href="/settings/security" className="underline hover:opacity-70">Security Settings</Link>
        </div>

    </div>
  );

  if (embedded) {
    return (
      <>
        {content}
        {toast && (
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-medium shadow-lg"
            style={{ background: "var(--foreground)", color: "var(--background)", zIndex: 100 }}
            role="status"
          >
            {toast}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <HamburgerNav
        currentPage="settings"
        title="🔐 Privacy Hub"
        signOutAction={handleSignOut}
        rightContent={
          <>
            <Link href="/settings" className="text-xs btn-interact rounded-xl px-3 py-2" style={{ color: "var(--foreground)", opacity: 0.5 }}>Settings</Link>
            <Link href="/settings/security" className="text-xs btn-interact rounded-xl px-3 py-2" style={{ color: "var(--foreground)", opacity: 0.5 }}>Security</Link>
          </>
        }
      />

      <main id="main-content">
        {content}
      </main>

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-medium shadow-lg"
          style={{ background: "var(--foreground)", color: "var(--background)", zIndex: 100 }}
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
