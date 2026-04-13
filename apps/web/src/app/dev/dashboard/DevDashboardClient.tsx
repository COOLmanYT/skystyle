"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface DeletionRequest {
  id: string;
  user_id: string;
  reason: string | null;
  status: "pending" | "approved" | "declined";
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
  users: { name: string | null; email: string | null };
}

interface DevMessage {
  id: string;
  content: string;
  from_dev: boolean;
  read_at: string | null;
  created_at: string;
}

type Section = "triage" | "chat" | "changelog" | "health";

export default function DevDashboardClient({ initialSection = "triage" }: { initialSection?: Section }) {
  const [section, setSection] = useState<Section>(initialSection);
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<DevMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [adminNote, setAdminNote] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchDeletion = useCallback(async () => {
    const res = await fetch("/api/dev/deletion-requests");
    if (res.ok) setDeletionRequests(await res.json());
  }, []);

  const fetchChat = useCallback(async (userId: string) => {
    const res = await fetch(`/api/dev/messages?userId=${userId}`);
    if (res.ok) setChatMessages(await res.json());
  }, []);

  useEffect(() => {
    if (section === "triage") fetchDeletion();
  }, [section, fetchDeletion]);

  useEffect(() => {
    if (selectedUserId) fetchChat(selectedUserId);
  }, [selectedUserId, fetchChat]);

  async function handleTriage(id: string, action: "approve" | "decline") {
    setLoading(true);
    const res = await fetch("/api/dev/deletion-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, admin_note: adminNote[id] ?? null }),
    });
    setLoading(false);
    if (res.ok) {
      showToast(`Request ${action}d.`);
      fetchDeletion();
    } else {
      showToast("Failed.");
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedUserId) return;
    setLoading(true);
    await fetch("/api/dev/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newMessage.trim(), userId: selectedUserId }),
    });
    setLoading(false);
    setNewMessage("");
    fetchChat(selectedUserId);
  }

  const navItems: { id: Section; label: string; emoji: string }[] = [
    { id: "triage", label: "Triage", emoji: "🗂️" },
    { id: "chat", label: "Chat", emoji: "💬" },
    { id: "changelog", label: "Changelog", emoji: "📝" },
    { id: "health", label: "Health", emoji: "📊" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Nav */}
      <nav
        className="sticky-nav px-4 py-3"
        style={{ borderBottom: "1px solid var(--card-border)" }}
      >
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Link
              href="/dev"
              className="text-sm btn-interact rounded-xl px-3 py-2"
              style={{ color: "var(--foreground)", opacity: 0.6 }}
            >
              ← Dev Center
            </Link>
            <span className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
              Dev Center
            </span>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tab Bar */}
        <div className="flex gap-2 flex-wrap mb-6">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className="rounded-xl px-4 py-2 text-sm font-medium btn-interact"
              style={{
                background: section === item.id ? "var(--foreground)" : "var(--card)",
                color: section === item.id ? "var(--background)" : "var(--foreground)",
                border: "1px solid var(--card-border)",
                opacity: section === item.id ? 1 : 0.7,
              }}
            >
              {item.emoji} {item.label}
            </button>
          ))}
        </div>

        {/* Triage */}
        {section === "triage" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              Deletion Requests
            </h2>
            {deletionRequests.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--foreground)", opacity: 0.5 }}>
                No pending deletion requests.
              </p>
            ) : (
              deletionRequests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-2xl p-5 space-y-3"
                  style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        {req.users?.name ?? "Unknown"}{" "}
                        <span style={{ opacity: 0.5 }}>({req.users?.email})</span>
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--foreground)", opacity: 0.45 }}>
                        Requested: {new Date(req.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background:
                          req.status === "pending"
                            ? "#ff9500"
                            : req.status === "approved"
                            ? "#30d158"
                            : "#ff3b30",
                        color: "#fff",
                      }}
                    >
                      {req.status}
                    </span>
                  </div>
                  {req.reason && (
                    <p className="text-xs rounded-xl p-3" style={{ background: "var(--background)", color: "var(--foreground)", opacity: 0.7 }}>
                      <strong>Reason:</strong> {req.reason}
                    </p>
                  )}
                  {req.status === "pending" && (
                    <div className="space-y-2">
                      <textarea
                        value={adminNote[req.id] ?? ""}
                        onChange={(e) => setAdminNote((p) => ({ ...p, [req.id]: e.target.value }))}
                        placeholder="Admin note (optional)..."
                        rows={2}
                        className="w-full text-xs rounded-xl px-3 py-2 resize-none"
                        style={{
                          background: "var(--background)",
                          color: "var(--foreground)",
                          border: "1px solid var(--card-border)",
                          outline: "none",
                        }}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleTriage(req.id, "approve")}
                          disabled={loading}
                          className="rounded-xl px-4 py-2 text-xs font-semibold btn-interact"
                          style={{ background: "#30d158", color: "#fff" }}
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() => handleTriage(req.id, "decline")}
                          disabled={loading}
                          className="rounded-xl px-4 py-2 text-xs font-semibold btn-interact"
                          style={{ background: "#ff3b30", color: "#fff" }}
                        >
                          ❌ Decline
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUserId(req.user_id);
                            setSection("chat");
                          }}
                          className="rounded-xl px-4 py-2 text-xs font-medium btn-interact"
                          style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--card-border)" }}
                        >
                          💬 Chat
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Chat */}
        {section === "chat" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              User Chat
            </h2>
            {!selectedUserId ? (
              <div className="space-y-2">
                <p className="text-sm" style={{ color: "var(--foreground)", opacity: 0.5 }}>
                  Select a user from the Triage tab to open their chat.
                </p>
                {deletionRequests.length > 0 && (
                  <div className="space-y-2">
                    {deletionRequests.map((req) => (
                      <button
                        key={req.user_id}
                        onClick={() => { setSelectedUserId(req.user_id); fetchChat(req.user_id); }}
                        className="block text-left w-full rounded-xl p-3 btn-interact"
                        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
                      >
                        <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                          {req.users?.name ?? req.users?.email ?? req.user_id}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => setSelectedUserId(null)}
                  className="text-xs btn-interact"
                  style={{ color: "var(--foreground)", opacity: 0.5 }}
                >
                  ← Back
                </button>
                <div
                  className="rounded-2xl p-4 space-y-3 max-h-96 overflow-y-auto"
                  style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
                >
                  {chatMessages.length === 0 ? (
                    <p className="text-xs text-center" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                      No messages yet.
                    </p>
                  ) : (
                    chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.from_dev ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className="max-w-xs rounded-2xl px-4 py-2 text-xs"
                          style={{
                            background: msg.from_dev ? "var(--accent)" : "var(--background)",
                            color: msg.from_dev ? "#fff" : "var(--foreground)",
                          }}
                        >
                          {msg.content}
                          <div className="text-xs mt-1 opacity-60">
                            {new Date(msg.created_at).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Reply as dev..."
                    className="flex-1 text-sm rounded-xl px-4 py-2"
                    style={{
                      background: "var(--card)",
                      color: "var(--foreground)",
                      border: "1px solid var(--card-border)",
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={loading || !newMessage.trim()}
                    className="rounded-xl px-4 py-2 text-sm font-medium btn-interact"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Changelog CMS */}
        {section === "changelog" && <ChangelogCMS />}

        {/* Health */}
        {section === "health" && <HealthPanel />}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-medium shadow-lg"
          style={{ background: "var(--foreground)", color: "var(--background)", zIndex: 100 }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function ChangelogCMS() {
  const [version, setVersion] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function publish() {
    if (!version.trim() || !title.trim()) return;
    setSaving(true);
    // Write directly to changelog.json via a dev API (future: DB-driven)
    // For now, show instructions
    setSaved(true);
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
        Changelog CMS
      </h2>
      <div
        className="rounded-2xl p-5 space-y-3"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
      >
        <input
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="Version (e.g. 2.1.0)"
          className="w-full text-sm rounded-xl px-4 py-2"
          style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--card-border)", outline: "none" }}
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full text-sm rounded-xl px-4 py-2"
          style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--card-border)", outline: "none" }}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Body (Markdown supported)..."
          rows={6}
          className="w-full text-sm rounded-xl px-4 py-2 resize-none"
          style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--card-border)", outline: "none" }}
        />
        <button
          onClick={publish}
          disabled={saving}
          className="rounded-xl px-5 py-2 text-sm font-semibold btn-interact"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {saving ? "Publishing…" : "Publish Entry"}
        </button>
        {saved && (
          <p className="text-xs" style={{ color: "#30d158" }}>
            ✅ Entry staged. Update changelog.json to finalize.
          </p>
        )}
      </div>
    </div>
  );
}

function HealthPanel() {
  interface ServiceCheck {
    status: "ok" | "degraded" | "error" | "unconfigured";
    latencyMs: number | null;
    detail: string;
  }
  interface HealthData {
    checkedAt: string;
    supabase: ServiceCheck;
    weather: ServiceCheck;
    ai: ServiceCheck & { provider: string };
    env: {
      openaiConfigured: boolean;
      geminiConfigured: boolean;
      openweatherConfigured: boolean;
      supabaseConfigured: boolean;
      nodeEnv: string;
    };
  }

  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const runChecks = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/dev/health");
      if (!res.ok) {
        setFetchError(`Health API returned ${res.status}`);
      } else {
        const data = await res.json() as HealthData;
        setHealth(data);
        setFetchedAt(new Date().toISOString());
      }
    } catch {
      setFetchError("Failed to reach health endpoint.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  const statusColor = (s: ServiceCheck["status"]) => {
    if (s === "ok") return "#30d158";
    if (s === "degraded") return "#ff9500";
    if (s === "error") return "#ff3b30";
    return "var(--foreground)";
  };
  const statusLabel = (s: ServiceCheck["status"]) => {
    if (s === "ok") return "✅ Operational";
    if (s === "degraded") return "⚠️ Degraded";
    if (s === "error") return "❌ Error";
    return "— Not configured";
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          System Health
        </h2>
        <div className="flex items-center gap-3">
          {fetchedAt && (
            <span className="text-xs" style={{ color: "var(--foreground)", opacity: 0.45 }}>
              Last checked: {new Date(fetchedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={runChecks}
            disabled={loading}
            className="rounded-xl px-4 py-2 text-xs font-medium btn-interact disabled:opacity-40"
            style={{ background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--card-border)" }}
          >
            {loading ? "Checking…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {fetchError && (
        <p className="text-sm text-red-500">{fetchError}</p>
      )}

      {health ? (
        <>
          {/* Service Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(
              [
                {
                  label: "Weather API",
                  svc: health.weather,
                  sub: health.env.openweatherConfigured
                    ? "OpenWeatherMap"
                    : "OpenWeatherMap · Not configured",
                },
                { label: "AI Provider", svc: health.ai, sub: health.ai.provider !== "none" ? health.ai.provider : "—" },
                { label: "Supabase DB", svc: health.supabase, sub: "PostgreSQL" },
              ] as { label: string; svc: ServiceCheck; sub: string }[]
            ).map((item) => (
              <div
                key={item.label}
                className="rounded-2xl p-5 space-y-2"
                style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                  {item.label}
                </p>
                <p className="text-sm font-semibold" style={{ color: statusColor(item.svc.status) }}>
                  {statusLabel(item.svc.status)}
                </p>
                <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.55 }}>
                  {item.sub}
                </p>
                {item.svc.latencyMs !== null && (
                  <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.4 }}>
                    {item.svc.latencyMs} ms
                  </p>
                )}
                {item.svc.detail && item.svc.status !== "ok" && (
                  <p className="text-xs rounded-lg px-2 py-1 break-all" style={{ background: "var(--background)", color: "#ff3b30", border: "1px solid var(--card-border)" }}>
                    {item.svc.detail}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Latency Summary */}
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>
              API Response Latency
            </p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Weather", ms: health.weather.latencyMs },
                { label: "AI Provider", ms: health.ai.latencyMs },
                { label: "Supabase", ms: health.supabase.latencyMs },
              ].map((r) => (
                <div key={r.label} className="text-center">
                  <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.5 }}>{r.label}</p>
                  <p
                    className="text-xl font-bold mt-1"
                    style={{
                      color: r.ms === null ? "var(--foreground)"
                        : r.ms < 300 ? "#30d158"
                        : r.ms < 800 ? "#ff9500"
                        : "#ff3b30",
                      opacity: r.ms === null ? 0.3 : 1,
                    }}
                  >
                    {r.ms === null ? "—" : `${r.ms}ms`}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Environment Config */}
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground)", opacity: 0.4 }}>
              Environment
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "OpenAI", ok: health.env.openaiConfigured },
                { label: "Gemini", ok: health.env.geminiConfigured },
                { label: "OpenWeather", ok: health.env.openweatherConfigured },
                { label: "Supabase", ok: health.env.supabaseConfigured },
              ].map((e) => (
                <span
                  key={e.label}
                  className="text-xs px-3 py-1 rounded-full font-medium"
                  style={{
                    background: e.ok ? "rgba(48,209,88,0.12)" : "rgba(255,59,48,0.1)",
                    color: e.ok ? "#30d158" : "#ff3b30",
                    border: `1px solid ${e.ok ? "rgba(48,209,88,0.25)" : "rgba(255,59,48,0.2)"}`,
                  }}
                >
                  {e.ok ? "✓" : "✗"} {e.label}
                </span>
              ))}
              <span
                className="text-xs px-3 py-1 rounded-full font-medium"
                style={{
                  background: "rgba(191,90,242,0.1)",
                  color: "#bf5af2",
                  border: "1px solid rgba(191,90,242,0.2)",
                }}
              >
                {health.env.nodeEnv}
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.35 }}>
              Checked at {new Date(health.checkedAt).toLocaleString()}
            </p>
          </div>
        </>
      ) : !loading && (
        <p className="text-sm text-center py-8" style={{ color: "var(--foreground)", opacity: 0.4 }}>
          No health data yet — click Refresh to run checks.
        </p>
      )}
    </div>
  );
}
