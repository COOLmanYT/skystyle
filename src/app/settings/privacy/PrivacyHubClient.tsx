"use client";

import { useState } from "react";
import Link from "next/link";

interface PrivacyHubClientProps {
  isPendingDeletion: boolean;
  /** When true, suppresses the full-page shell (nav + min-h-screen wrapper) for embedding inside another page. */
  embedded?: boolean;
}

export default function PrivacyHubClient({ isPendingDeletion: initialPending, embedded = false }: PrivacyHubClientProps) {
  const [isPendingDeletion, setIsPendingDeletion] = useState(initialPending);
  const [deletionReason, setDeletionReason] = useState("");
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      <nav
        className="sticky-nav px-4 py-3"
        style={{ borderBottom: "1px solid var(--card-border)" }}
      >
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign("/dashboard")}
              className="text-sm btn-interact rounded-xl px-3 py-2"
              style={{ color: "var(--foreground)", opacity: 0.6 }}
            >
              ←
            </button>
            <span className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              🔐 Privacy Hub
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/settings" className="text-xs btn-interact rounded-xl px-3 py-2" style={{ color: "var(--foreground)", opacity: 0.5 }}>Settings</Link>
            <Link href="/settings/security" className="text-xs btn-interact rounded-xl px-3 py-2" style={{ color: "var(--foreground)", opacity: 0.5 }}>Security</Link>
          </div>
        </div>
      </nav>

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
