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
  errorRate: number | null;
  avgResponseTimeMs: number | null;
}

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };

/** Inline SVG area + line chart for time-series data. */
function LineChart({ data }: { data: UsagePoint[] }) {
  if (data.length < 2) return null;
  const W = 1000;
  const H = 100;
  const PAD = 6;
  const maxVal = data.reduce((m, p) => Math.max(m, p.count), 0);
  const toX = (i: number) => PAD + (i / (data.length - 1)) * (W - PAD * 2);
  const toY = (v: number) =>
    maxVal > 0 ? PAD + (1 - v / maxVal) * (H - PAD * 2) : H - PAD;
  const pts = data.map((p, i) => `${toX(i).toFixed(1)},${toY(p.count).toFixed(1)}`);
  const linePoints = pts.join(" ");
  const bottomY = (H - PAD).toFixed(1);
  const areaPoints = [
    `${toX(0).toFixed(1)},${bottomY}`,
    ...pts,
    `${toX(data.length - 1).toFixed(1)},${bottomY}`,
  ].join(" ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ width: "100%", height: "80px", display: "block" }}
    >
      <defs>
        <linearGradient id="lcAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopOpacity={0.3} style={{ stopColor: "var(--accent)" }} />
          <stop offset="100%" stopOpacity={0} style={{ stopColor: "var(--accent)" }} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#lcAreaGrad)" />
      <polyline
        points={linePoints}
        fill="none"
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ stroke: "var(--accent)" }}
      />
    </svg>
  );
}

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
        errorRate: typeof data.errorRate === "number" ? data.errorRate : null,
        avgResponseTimeMs: typeof data.avgResponseTimeMs === "number" ? data.avgResponseTimeMs : null,
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

  /** Endpoints sorted by call count descending for the bar chart. */
  const sortedEndpoints = useMemo((): [string, number][] => {
    if (!usage?.endpointCounts) return [];
    return (API_DASHBOARD_ENDPOINTS as readonly string[])
      .map((ep): [string, number] => [ep, usage.endpointCounts[ep] ?? 0])
      .sort(([, a], [, b]) => b - a);
  }, [usage]);

  const maxEndpointCount = useMemo(
    () => (sortedEndpoints.length > 0 ? sortedEndpoints[0][1] : 0),
    [sortedEndpoints]
  );

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

        {/* ── API Key Management ─────────────────────────────────────────── */}
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
                    <p className="text-xs mt-0.5" aria-label={`Created date ${new Date(key.created_at).toLocaleString(undefined, DATE_TIME_OPTIONS)}`} style={{ color: "var(--foreground)", opacity: 0.45 }}>
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

        {/* ── Analytics ──────────────────────────────────────────────────── */}
        <section className="rounded-2xl p-6 space-y-5" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>
              Analytics
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--foreground)", opacity: 0.55 }}>
              Last 24 hours across all your API keys
            </p>
          </div>

          {loadingUsage ? (
            <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.5 }}>Loading analytics…</p>
          ) : !usage ? (
            <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.4 }}>Analytics data is unavailable right now.</p>
          ) : (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl p-4" style={{ background: "var(--background)" }}>
                  <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.5 }}>Total requests</p>
                  <p className="text-2xl font-semibold mt-1" style={{ color: "var(--foreground)" }}>
                    {usage.totalRequests24h}
                  </p>
                </div>
                <div className="rounded-xl p-4" style={{ background: "var(--background)" }}>
                  <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.5 }}>Error rate</p>
                  <p
                    className="text-2xl font-semibold mt-1"
                    style={{ color: usage.errorRate != null && usage.errorRate > 10 ? "#ff3b30" : "var(--foreground)" }}
                  >
                    {usage.errorRate != null ? `${usage.errorRate}%` : "—"}
                  </p>
                </div>
                <div className="rounded-xl p-4" style={{ background: "var(--background)" }}>
                  <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.5 }}>Avg response time</p>
                  <p className="text-2xl font-semibold mt-1" style={{ color: "var(--foreground)" }}>
                    {usage.avgResponseTimeMs != null ? `${usage.avgResponseTimeMs}ms` : "—"}
                  </p>
                </div>
              </div>

              {/* Requests over time — SVG line chart */}
              {usage.requestsOverTime.length > 0 && (
                <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--background)" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                    Requests over time
                  </p>
                  <LineChart data={usage.requestsOverTime} />
                  <div className="flex justify-between text-[10px]" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                    <span>{usage.requestsOverTime[0]?.label ?? ""}</span>
                    <span>{usage.requestsOverTime[Math.floor(usage.requestsOverTime.length / 2)]?.label ?? ""}</span>
                    <span>{usage.requestsOverTime[usage.requestsOverTime.length - 1]?.label ?? ""}</span>
                  </div>
                </div>
              )}

              {/* Top endpoints — horizontal bar chart */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--background)" }}>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                  Top endpoints
                </p>
                {usage.totalRequests24h === 0 ? (
                  <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                    No API activity yet in the last 24 hours.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {sortedEndpoints.map(([endpoint, count]) => (
                      <div key={endpoint} className="space-y-1.5">
                        <div className="flex justify-between items-baseline">
                          <p className="text-xs font-medium" style={{ color: "var(--foreground)", opacity: 0.8 }}>{endpoint}</p>
                          <p className="text-xs font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>{count}</p>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(127,127,127,0.15)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${maxEndpointCount > 0 ? Math.max((count / maxEndpointCount) * 100, count > 0 ? 3 : 0) : 0}%`,
                              background: "var(--accent)",
                              opacity: 0.85,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

