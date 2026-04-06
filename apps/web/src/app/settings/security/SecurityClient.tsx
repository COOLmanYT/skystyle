"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Toggle from "@/components/Toggle";

interface SecurityLog {
  id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

interface Passkey {
  id: string;
  display_name: string | null;
  transports: string | null;
  created_at: string;
}

const EVENT_LABELS: Record<string, string> = {
  login: "🔑 New sign-in",
  logout: "👋 Signed out",
  password_changed: "🔒 Password changed",
  passkey_added: "🪪 Passkey added",
  passkey_removed: "🗑️ Passkey removed",
  mfa_enabled: "🛡️ 2FA enabled",
  mfa_disabled: "⚠️ 2FA disabled",
  recovery_codes_generated: "🔄 Recovery codes regenerated",
  provider_linked: "🔗 Provider linked",
  provider_unlinked: "🔓 Provider unlinked",
  deletion_requested: "🗑️ Deletion requested",
  deletion_cancelled: "↩️ Deletion cancelled",
  data_export: "📦 Data exported",
};

interface SecurityClientProps {
  mfaEnabled: boolean;
  /** When true, suppresses the full-page shell (nav + min-h-screen wrapper) for embedding inside another page. */
  embedded?: boolean;
}

export default function SecurityClient({ mfaEnabled: initialMfaEnabled, embedded = false }: SecurityClientProps) {
  const [mfaEnabled, setMfaEnabled] = useState(initialMfaEnabled);
  const [setupStep, setSetupStep] = useState<"idle" | "qr" | "codes">("idle");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpToken, setTotpToken] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [disableToken, setDisableToken] = useState("");
  const [showDisable, setShowDisable] = useState(false);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [loadingMfa, setLoadingMfa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [regenToken, setRegenToken] = useState("");
  const [showRegen, setShowRegen] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchPasskeys = useCallback(async () => {
    const res = await fetch("/api/passkeys/list");
    if (res.ok) setPasskeys(await res.json());
  }, []);

  const fetchLogs = useCallback(async () => {
    const res = await fetch("/api/security/logs");
    if (res.ok) setSecurityLogs(await res.json());
  }, []);

  useEffect(() => {
    fetchPasskeys();
    fetchLogs();
  }, [fetchPasskeys, fetchLogs]);

  async function startMfaSetup() {
    setLoadingMfa(true);
    setError(null);
    const res = await fetch("/api/mfa/setup", { method: "POST" });
    setLoadingMfa(false);
    if (!res.ok) { setError("Failed to start setup."); return; }
    const data = await res.json();
    setQrDataUrl(data.qrDataUrl);
    setTotpSecret(data.secret);
    setSetupStep("qr");
  }

  async function verifyMfa() {
    if (!/^\d{6}$/.test(totpToken)) { setError("Enter a 6-digit code."); return; }
    setLoadingMfa(true);
    setError(null);
    const res = await fetch("/api/mfa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: totpToken }),
    });
    setLoadingMfa(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Verification failed."); return; }
    const data = await res.json();
    setRecoveryCodes(data.recoveryCodes);
    setMfaEnabled(true);
    setSetupStep("codes");
    setTotpToken("");
    fetchLogs();
  }

  async function disableMfa() {
    if (!/^\d{6}$/.test(disableToken)) { setError("Enter a 6-digit code."); return; }
    setLoadingMfa(true);
    setError(null);
    const res = await fetch("/api/mfa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: disableToken }),
    });
    setLoadingMfa(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed."); return; }
    setMfaEnabled(false);
    setShowDisable(false);
    setDisableToken("");
    showToast("Two-factor authentication disabled.");
    fetchLogs();
  }

  async function regenCodes() {
    if (!/^\d{6}$/.test(regenToken)) { setError("Enter a 6-digit code."); return; }
    setLoadingMfa(true);
    setError(null);
    const res = await fetch("/api/recovery-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: regenToken }),
    });
    setLoadingMfa(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed."); return; }
    const data = await res.json();
    setRecoveryCodes(data.recoveryCodes);
    setShowRegen(false);
    setRegenToken("");
    setSetupStep("codes");
    fetchLogs();
  }

  async function removePasskey(id: string) {
    const res = await fetch("/api/passkeys/list", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) { showToast("Passkey removed."); fetchPasskeys(); fetchLogs(); }
  }

  async function downloadCodes() {
    const text = recoveryCodes.join("\n");
    const blob = new Blob([`Sky Style — Recovery Codes\nGenerated: ${new Date().toISOString()}\n\n${text}\n\nKeep these codes safe. Each code can only be used once.\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "skystyle-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const content = (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

      {error && (
        <div
          role="alert"
          className="rounded-2xl p-4 text-sm"
          style={{ background: "rgba(255,59,48,0.1)", color: "#ff3b30", border: "1px solid rgba(255,59,48,0.2)" }}
        >
            {error}
          </div>
        )}

        {/* ── Two-Factor Authentication ── */}
        <section
          className="rounded-2xl p-6 space-y-4"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                Two-Factor Authentication
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground)", opacity: 0.55 }}>
                Use an authenticator app (Google Authenticator, Authy, Bitwarden) for extra security.
              </p>
            </div>
            <Toggle
              checked={mfaEnabled}
              onChange={(val) => {
                if (!val && mfaEnabled) setShowDisable(true);
                else if (val && !mfaEnabled) startMfaSetup();
              }}
            />
          </div>

          {/* Setup: QR code */}
          {setupStep === "qr" && qrDataUrl && (
            <div className="space-y-4 pt-2">
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                Scan with your authenticator app:
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="TOTP QR Code" width={160} height={160} className="rounded-xl" />
              {totpSecret && (
                <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.5 }}>
                  Manual key:{" "}
                  <code
                    className="px-2 py-0.5 rounded font-mono"
                    style={{ background: "var(--background)" }}
                  >
                    {totpSecret}
                  </code>
                </p>
              )}
              <input
                value={totpToken}
                onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter 6-digit code"
                inputMode="numeric"
                maxLength={6}
                className="w-full text-sm rounded-xl px-4 py-3 text-center tracking-[0.3em]"
                style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--card-border)", outline: "none" }}
              />
              <button
                onClick={verifyMfa}
                disabled={loadingMfa || totpToken.length !== 6}
                className="w-full rounded-xl px-5 py-2.5 text-sm font-semibold btn-interact"
                style={{ background: "var(--accent)", color: "#fff", opacity: totpToken.length !== 6 ? 0.5 : 1 }}
              >
                {loadingMfa ? "Verifying…" : "Verify & Enable 2FA"}
              </button>
            </div>
          )}

          {/* Recovery codes shown once */}
          {setupStep === "codes" && recoveryCodes.length > 0 && (
            <div className="space-y-3 pt-2">
              <p className="text-sm font-semibold" style={{ color: "#ff9500" }}>
                ⚠️ Save these recovery codes — shown only once.
              </p>
              <div
                className="rounded-xl p-4 font-mono text-xs grid grid-cols-2 gap-1"
                style={{ background: "var(--background)", color: "var(--foreground)" }}
              >
                {recoveryCodes.map((code) => (
                  <span key={code}>{code}</span>
                ))}
              </div>
              <button
                onClick={downloadCodes}
                className="rounded-xl px-5 py-2 text-sm font-medium btn-interact"
                style={{ background: "var(--foreground)", color: "var(--background)" }}
              >
                ⬇️ Download recovery-codes.txt
              </button>
              <button
                onClick={() => { setSetupStep("idle"); setRecoveryCodes([]); }}
                className="text-xs btn-interact"
                style={{ color: "var(--foreground)", opacity: 0.5 }}
              >
                I&apos;ve saved them →
              </button>
            </div>
          )}

          {/* Disable MFA */}
          {showDisable && (
            <div className="space-y-3 pt-2">
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                Enter your current authenticator code to disable 2FA:
              </p>
              <input
                value={disableToken}
                onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code"
                inputMode="numeric"
                maxLength={6}
                className="w-full text-sm rounded-xl px-4 py-3 text-center tracking-[0.3em]"
                style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--card-border)", outline: "none" }}
              />
              <div className="flex gap-2">
                <button
                  onClick={disableMfa}
                  disabled={loadingMfa || disableToken.length !== 6}
                  className="rounded-xl px-5 py-2 text-sm font-semibold btn-interact"
                  style={{ background: "#ff3b30", color: "#fff" }}
                >
                  Disable 2FA
                </button>
                <button
                  onClick={() => { setShowDisable(false); setDisableToken(""); setError(null); }}
                  className="rounded-xl px-5 py-2 text-sm btn-interact"
                  style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--card-border)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Regenerate recovery codes */}
          {mfaEnabled && setupStep === "idle" && !showDisable && (
            <div className="pt-1">
              {showRegen ? (
                <div className="space-y-3">
                  <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.6 }}>
                    Enter authenticator code to regenerate recovery codes (invalidates old ones):
                  </p>
                  <input
                    value={regenToken}
                    onChange={(e) => setRegenToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                    inputMode="numeric"
                    maxLength={6}
                    className="w-full text-sm rounded-xl px-4 py-3 text-center tracking-[0.3em]"
                    style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--card-border)", outline: "none" }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={regenCodes}
                      disabled={loadingMfa || regenToken.length !== 6}
                      className="rounded-xl px-4 py-2 text-xs font-semibold btn-interact"
                      style={{ background: "var(--accent)", color: "#fff" }}
                    >
                      Regenerate
                    </button>
                    <button
                      onClick={() => { setShowRegen(false); setRegenToken(""); }}
                      className="text-xs btn-interact rounded-xl px-3 py-2"
                      style={{ color: "var(--foreground)", opacity: 0.5 }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowRegen(true)}
                  className="text-xs btn-interact"
                  style={{ color: "var(--foreground)", opacity: 0.5 }}
                >
                  🔄 Regenerate recovery codes
                </button>
              )}
            </div>
          )}
        </section>

        {/* ── Passkeys ── */}
        <section
          className="rounded-2xl p-6 space-y-4"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                Passkeys
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground)", opacity: 0.55 }}>
                Sign in with Face ID, Touch ID, Windows Hello, or hardware security keys.
              </p>
            </div>
            <PasskeyRegisterButton onSuccess={() => { fetchPasskeys(); fetchLogs(); showToast("Passkey added!"); }} />
          </div>

          {passkeys.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.4 }}>
              No passkeys registered.
            </p>
          ) : (
            <div className="space-y-2">
              {passkeys.map((pk) => (
                <div
                  key={pk.id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: "var(--background)" }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                      🪪 {pk.display_name ?? "Passkey"}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--foreground)", opacity: 0.45 }}>
                      Added {new Date(pk.created_at).toLocaleDateString()}
                      {pk.transports ? ` · ${pk.transports.split(",").join(", ")}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => removePasskey(pk.id)}
                    className="text-xs btn-interact px-3 py-1.5 rounded-xl"
                    style={{ background: "rgba(255,59,48,0.1)", color: "#ff3b30" }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Security Log ── */}
        <section
          className="rounded-2xl p-6 space-y-4"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>
            Security Log
          </p>

          {securityLogs.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.4 }}>
              No security events recorded yet.
            </p>
          ) : (
            <div className="space-y-2">
              {securityLogs.slice(0, 20).map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-xl"
                  style={{ background: "var(--background)" }}
                >
                  <div>
                    <p className="text-sm" style={{ color: "var(--foreground)" }}>
                      {EVENT_LABELS[log.event_type] ?? log.event_type}
                    </p>
                    {log.ip_address && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                        IP: {log.ip_address}
                      </p>
                    )}
                  </div>
                  <p className="text-xs flex-shrink-0" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

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
              🛡️ Security
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/settings" className="text-xs btn-interact rounded-xl px-3 py-2" style={{ color: "var(--foreground)", opacity: 0.5 }}>Settings</Link>
            <Link href="/account" className="text-xs btn-interact rounded-xl px-3 py-2" style={{ color: "var(--foreground)", opacity: 0.5 }}>Account</Link>
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

function PasskeyRegisterButton({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("My Passkey");
  const [showForm, setShowForm] = useState(false);

  async function register() {
    setLoading(true);
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const optRes = await fetch("/api/passkeys/register");
      if (!optRes.ok) throw new Error("Failed to get options");
      const options = await optRes.json();

      const credential = await startRegistration(options);

      const verifyRes = await fetch("/api/passkeys/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...credential, displayName: name }),
      });
      if (!verifyRes.ok) throw new Error("Verification failed");
      onSuccess();
      setShowForm(false);
    } catch (e) {
      console.error("Passkey registration failed:", e);
    } finally {
      setLoading(false);
    }
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="text-xs rounded-xl px-3 py-1.5 btn-interact"
        style={{ background: "var(--accent)", color: "#fff" }}
      >
        + Add
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name (e.g. iPhone)"
        className="text-xs rounded-xl px-3 py-1.5"
        style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--card-border)", outline: "none" }}
      />
      <button
        onClick={register}
        disabled={loading}
        className="text-xs rounded-xl px-3 py-1.5 btn-interact"
        style={{ background: "var(--accent)", color: "#fff" }}
      >
        {loading ? "…" : "Register"}
      </button>
      <button
        onClick={() => setShowForm(false)}
        className="text-xs"
        style={{ color: "var(--foreground)", opacity: 0.5 }}
      >
        ✕
      </button>
    </div>
  );
}
