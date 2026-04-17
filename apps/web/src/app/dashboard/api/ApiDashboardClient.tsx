"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import HamburgerNav from "@/components/HamburgerNav";
import { handleSignOut } from "@/app/actions";
import { API_DASHBOARD_ENDPOINTS } from "@/lib/api-key-credits";

interface ApiKey {
  id: string;
  key_preview: string;
  created_at: string;
  revoked: boolean;
  credits_remaining?: number;
  credits_used?: number;
}

interface UsagePoint {
  label: string;
  count: number;
}

interface UsagePayload {
  totalRequests24h: number;
  endpointCounts: Record<string, number>;
  requestsOverTime: UsagePoint[];
}

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };
const MIN_VISIBLE_NON_ZERO_BAR_PERCENT = 6;
const MIN_BAR_PERCENT = 2;

export default function ApiDashboardClient() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [usage, setUsage] = useState<UsagePayload | null>(null);
  const [loadingApiKeys, setLoadingApiKeys] = useState(true);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [busyAction, setBusyAction] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchApiKeys = useCallback(async () => {
    setLoadingApiKeys(true);
    try {
      const res = await fetch("/api/api-keys");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Failed to load API keys.");
      }
      const data = await res.json();
      setApiKeys(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys.");
    } finally {
      setLoadingApiKeys(false);
    }
  }, []);

  const fetchUsage = useCallback(async () => {
    setLoadingUsage(true);
    try {
      const res = await fetch("/api/api-usage");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Failed to load API usage.");
      }
      const data = await res.json();
      setUsage({
        totalRequests24h: typeof data.totalRequests24h === "number" ? data.totalRequests24h : 0,
        endpointCounts: typeof data.endpointCounts === "object" && data.endpointCounts ? data.endpointCounts : {},
        requestsOverTime: Array.isArray(data.requestsOverTime) ? data.requestsOverTime : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API usage.");
    } finally {
      setLoadingUsage(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setError(null);
    await Promise.all([fetchApiKeys(), fetchUsage()]);
  }, [fetchApiKeys, fetchUsage]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const maxChartValue = useMemo(() => {
    if (!usage?.requestsOverTime?.length) return 0;
    return usage.requestsOverTime.reduce((max, point) => Math.max(max, point.count), 0);
  }, [usage]);

  async function createApiKey() {
    setBusyAction(true);
    setError(null);
    try {
      const res = await fetch("/api/api-keys", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Failed to create API key.");
      }
      const data = await res.json();
      setNewApiKey(typeof data.apiKey === "string" ? data.apiKey : null);
      await refreshAll();
      showToast("API key created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key.");
    } finally {
      setBusyAction(false);
    }
  }

  async function revokeApiKey(id: string) {
    const confirmed = window.confirm("Revoke this API key? This action cannot be undone.");
    if (!confirmed) return;

    setBusyAction(true);
    setError(null);
    try {
      const res = await fetch("/api/api-keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Failed to revoke API key.");
      }
      await refreshAll();
      showToast("API key revoked.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke API key.");
    } finally {
      setBusyAction(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <HamburgerNav
        currentPage="other"
        title="🔐 API Dashboard"
        signOutAction={handleSignOut}
        rightContent={(
          <Link href="/dashboard" className="text-xs btn-interact rounded-xl px-3 py-2" style={{ color: "var(--foreground)", opacity: 0.6 }}>
            Back
          </Link>
        )}
      />

      <main id="main-content" className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {error && (
          <div
            role="alert"
            className="rounded-2xl p-4 text-sm"
            style={{ background: "rgba(255,59,48,0.1)", color: "#ff3b30", border: "1px solid rgba(255,59,48,0.2)" }}
          >
            {error}
          </div>
        )}

        <section className="rounded-2xl p-6 space-y-4" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                API Key Management
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground)", opacity: 0.55 }}>
                Create and revoke keys. Full keys are shown only once at creation.
              </p>
            </div>
            <button
              onClick={createApiKey}
              disabled={busyAction}
              className="rounded-xl px-4 py-2 text-xs font-semibold btn-interact"
              style={{ background: "var(--accent)", color: "#fff", opacity: busyAction ? 0.7 : 1 }}
            >
              {busyAction ? "Working…" : "Create new key"}
            </button>
          </div>

          {newApiKey && (
            <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--background)" }}>
              <p className="text-xs font-semibold" style={{ color: "#ff9500" }}>
                ⚠️ Copy this key now. You won&apos;t be able to view it again.
              </p>
              <code className="block text-xs break-all rounded-lg px-3 py-2" style={{ background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--card-border)" }}>
                {newApiKey}
              </code>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(newApiKey);
                      showToast("API key copied.");
                    } catch {
                      setError("Could not copy key automatically. Please copy it manually.");
                    }
                  }}
                  className="text-xs btn-interact rounded-xl px-3 py-2"
                  style={{ background: "var(--foreground)", color: "var(--background)" }}
                >
                  Copy key
                </button>
                <button
                  onClick={() => setNewApiKey(null)}
                  className="text-xs btn-interact rounded-xl px-3 py-2"
                  style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--card-border)" }}
                >
                  Hide
                </button>
              </div>
            </div>
          )}

          {loadingApiKeys ? (
            <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.5 }}>Loading API keys…</p>
          ) : apiKeys.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.4 }}>No API keys created yet.</p>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between gap-3 p-3 rounded-xl" style={{ background: "var(--background)" }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{key.key_preview}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--foreground)", opacity: 0.45 }}>
                      Created {new Date(key.created_at).toLocaleString(undefined, DATE_TIME_OPTIONS)}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--foreground)", opacity: 0.45 }}>
                      Status: <span aria-label={`API key status ${key.revoked ? "revoked" : "active"}`}>{key.revoked ? "Revoked" : "Active"}</span>
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--foreground)", opacity: 0.45 }}>
                      Credits: {Math.max(0, Number(key.credits_remaining ?? 0))} remaining · {Math.max(0, Number(key.credits_used ?? 0))} used
                    </p>
                  </div>
                  {!key.revoked && (
                    <button
                      onClick={() => revokeApiKey(key.id)}
                      disabled={busyAction}
                      className="text-xs btn-interact px-3 py-1.5 rounded-xl"
                      style={{ background: "rgba(255,59,48,0.1)", color: "#ff3b30", opacity: busyAction ? 0.7 : 1 }}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl p-6 space-y-4" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>
              Usage Overview
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--foreground)", opacity: 0.55 }}>
              Last 24 hours
            </p>
          </div>

          {loadingUsage ? (
            <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.5 }}>Loading usage…</p>
          ) : !usage ? (
            <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.4 }}>Usage data is unavailable right now.</p>
          ) : (
            <>
              <div className="rounded-xl p-3" style={{ background: "var(--background)" }}>
                <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.5 }}>Total requests (24h)</p>
                <p className="text-2xl font-semibold mt-1" style={{ color: "var(--foreground)" }}>{usage.totalRequests24h}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {API_DASHBOARD_ENDPOINTS.map((endpoint) => (
                  <div key={endpoint} className="rounded-xl p-3" style={{ background: "var(--background)" }}>
                    <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.5 }}>{endpoint}</p>
                    <p className="text-lg font-semibold mt-0.5" style={{ color: "var(--foreground)" }}>
                      {usage.endpointCounts[endpoint] ?? 0}
                    </p>
                  </div>
                ))}
              </div>

              {usage.requestsOverTime.length > 0 && (
                <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--background)" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                    Requests over time
                  </p>
                  <div className="flex items-end gap-1 h-24" aria-label="Usage chart">
                    {usage.requestsOverTime.map((point) => {
                      const height = maxChartValue > 0
                        ? Math.max((point.count / maxChartValue) * 100, point.count > 0 ? MIN_VISIBLE_NON_ZERO_BAR_PERCENT : MIN_BAR_PERCENT)
                        : MIN_BAR_PERCENT;
                      return (
                        <div key={point.label} className="flex-1 rounded-sm" style={{ height: `${height}%`, background: "var(--accent)", opacity: 0.75 }} title={`${point.label}: ${point.count}`} />
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[10px]" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                    <span>{usage.requestsOverTime[0]?.label ?? ""}</span>
                    <span>{usage.requestsOverTime[usage.requestsOverTime.length - 1]?.label ?? ""}</span>
                  </div>
                </div>
              )}

              {usage.totalRequests24h === 0 && (
                <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                  No API activity yet in the last 24 hours.
                </p>
              )}
            </>
          )}
        </section>
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
