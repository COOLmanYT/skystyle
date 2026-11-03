"use client";

import { useState, useEffect, useCallback } from "react";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import DevHealthPanel from "@/components/DevHealthPanel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sanitizeUrl } from "@/lib/sanitize-url";

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

export default function DevDashboardClient({ initialSection = "triage", initialUserId = null }: { initialSection?: Section; initialUserId?: string | null }) {
  const router = useRouter();
  const section = initialSection;
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>([]);
  const selectedUserId = initialUserId;
  const selectedContact = deletionRequests.find((request) => request.user_id === selectedUserId)?.users;
  const [chatMessages, setChatMessages] = useState<DevMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [adminNote, setAdminNote] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestFilter, setRequestFilter] = useState("pending");
  const [requestSearch, setRequestSearch] = useState("");
  const matchingRequests = deletionRequests.filter((request) => (requestFilter === "all" || request.status === requestFilter)
    && `${request.users?.name ?? ""} ${request.users?.email ?? ""} ${request.reason ?? ""}`.toLowerCase().includes(requestSearch.toLowerCase()));

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchDeletion = useCallback(async () => {
    setRequestsLoading(true); setLoadError("");
    try {
      const res = await fetch("/api/dev/deletion-requests", { cache: "no-store" });
      if (!res.ok) throw new Error(`Unable to load requests (${res.status}).`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("The request list was incomplete.");
      setDeletionRequests(data);
    } catch (failure) { setLoadError(failure instanceof Error ? failure.message : "Unable to load requests."); }
    finally { setRequestsLoading(false); }
  }, []);

  const fetchChat = useCallback(async (userId: string) => {
    setChatMessages([]); setLoadError("");
    try {
      const res = await fetch(`/api/dev/messages?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Unable to load messages (${res.status}).`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("The message list was incomplete.");
      setChatMessages(data);
    } catch (failure) { setLoadError(failure instanceof Error ? failure.message : "Unable to load messages."); }
  }, []);

  useEffect(() => {
    if (section === "triage" || section === "chat") { void (async () => fetchDeletion())(); }
  }, [section, fetchDeletion]);

  useEffect(() => {
    if (selectedUserId) { void (async () => fetchChat(selectedUserId))(); }
  }, [selectedUserId, fetchChat]);

  async function handleTriage(id: string, action: "approve" | "decline") {
    setLoading(true);
    try {
    const res = await fetch("/api/dev/deletion-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, admin_note: adminNote[id] ?? null }),
    });
    if (res.ok) {
      await fetchDeletion();
      showToast(action === "approve" ? "Request approved. Actual account deletion is a separate operation." : "Request declined.");
    } else {
      showToast(`Request was not updated (${res.status}).`);
    }
    } catch { showToast("Request could not be updated. Refresh before retrying."); }
    finally { setLoading(false); }
  }

  async function sendMessage() {
    if (loading || !newMessage.trim() || !selectedUserId) return;
    setLoading(true);
    try {
    const response = await fetch("/api/dev/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newMessage.trim(), userId: selectedUserId }),
    });
    if (!response.ok) { showToast(`Message was not sent (${response.status}). Your draft is kept.`); return; }
    setNewMessage("");
    await fetchChat(selectedUserId);
    } catch { showToast("Message could not be sent. Your draft is kept; refresh before retrying."); }
    finally { setLoading(false); }
  }

  const sectionMeta = {
    triage: { title: "Deletion requests", description: "Review each request, add a note, then approve or decline." },
    chat: { title: "User messages", description: "Continue a conversation with an account holder. Feedback tickets have their own workspace." },
    changelog: { title: "Changelog", description: "Write an update, check the preview, then publish when ready." },
    health: { title: "Service health", description: "Check provider connectivity. Open API activity to investigate individual requests." },
  }[section];
  return (
    <main id="main-content" className="space-y-6">
      <header className="rounded-3xl border p-6 sm:p-8" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest opacity-50">Dev Center</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{sectionMeta.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed opacity-65">{sectionMeta.description}</p>
      </header>
      {loadError && <p role="alert" className="rounded-xl border border-red-400 p-4 text-sm">{loadError} <button onClick={() => selectedUserId && section === "chat" ? void fetchChat(selectedUserId) : void fetchDeletion()} className="underline">Retry</button></p>}
        {/* Triage */}
        {section === "triage" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              Deletion Requests
            </h2>
            <p className="text-xs opacity-65">{deletionRequests.filter((request) => request.status === "pending").length} pending · {deletionRequests.length} recent requests. Approval records a decision; it does not delete account data.</p>
            <div className="flex flex-wrap gap-3"><input aria-label="Search deletion requests" value={requestSearch} onChange={(event) => setRequestSearch(event.target.value)} placeholder="Search name, email or reason" className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm" style={{ background: "var(--card)", borderColor: "var(--card-border)" }} /><select aria-label="Request status" value={requestFilter} onChange={(event) => setRequestFilter(event.target.value)} className="rounded-xl border px-3 py-2 text-sm" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>{["pending", "approved", "declined", "all"].map((status) => <option key={status} value={status}>{status}</option>)}</select><button onClick={() => void fetchDeletion()} disabled={requestsLoading} className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50" style={{ borderColor: "var(--card-border)" }}>Refresh</button></div>
            {requestsLoading ? <p role="status" className="text-sm opacity-65">Loading requests…</p> : matchingRequests.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--foreground)", opacity: 0.5 }}>
                {loadError ? "Requests could not be loaded." : "No requests match this view."}
              </p>
            ) : (
              matchingRequests.map((req) => (
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
                        aria-label={`Admin note for ${req.users?.name ?? req.user_id}`}
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
                            router.push(`/dev/chat?userId=${encodeURIComponent(req.user_id)}`);
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
                  Choose an account below, or open Users to find another account.
                </p>
                <Link href="/dev/operations/users" className="inline-block rounded-xl border px-4 py-2 text-sm" style={{ borderColor: "var(--card-border)" }}>Find an account in Users →</Link>
                {deletionRequests.length > 0 && (
                  <div className="space-y-2">
                    {deletionRequests.map((req) => (
                      <button
                        key={req.user_id}
                        onClick={() => router.push(`/dev/chat?userId=${encodeURIComponent(req.user_id)}`)}
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
                  onClick={() => router.push("/dev/chat")}
                  className="text-xs btn-interact"
                  style={{ color: "var(--foreground)", opacity: 0.5 }}
                >
                  ← Choose another account
                </button>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                  <div><h3 className="text-sm font-semibold">{selectedContact?.name ?? selectedContact?.email ?? "Account conversation"}</h3>{selectedContact?.name && selectedContact.email && <p className="mt-1 text-xs opacity-60">{selectedContact.email}</p>}</div>
                  <Link href={`/dev/operations/users/${selectedUserId}`} className="text-sm underline">View account →</Link>
                </div>
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
                    aria-label="Reply to user"
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
        {section === "health" && <DevHealthPanel />}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-medium shadow-lg"
          style={{ background: "var(--foreground)", color: "var(--background)", zIndex: 100 }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}

interface ChangelogEntry {
  releaseStatus?: "development" | "released";
  id?: string;
  date: string;
  version: string;
  title: string;
  description: string;
  category?: string;
  type?: "update" | "post";
  content?: string;
  image?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaLink?: string;
  expanded?: boolean;
  slug?: string;
  large?: boolean;
  showOnNextLogin?: boolean;
  published?: boolean;
}

const EMPTY_ENTRY: Omit<ChangelogEntry, "date" | "id"> = {
  version: "",
  title: "",
  description: "",
  category: "",
  type: "update",
  content: "",
  image: "",
  imageUrl: "",
  ctaLabel: "",
  ctaLink: "",
  expanded: false,
  slug: "",
  large: false,
  showOnNextLogin: false,
  published: false,
  releaseStatus: "development",
};

const SKY_MARKDOWN_GUIDE = `## Standard Markdown
**bold**, *italic*, ~~strikethrough~~, \`code\`
[Link text](https://url.com)
# H1  ## H2  ### H3  #### H4
> Blockquote
- Unordered list item
1. Ordered list item
---
| Column | Value |
| --- | ---: |
| Left | Right |
\`\`\`
code block
\`\`\`

## Sky Custom Syntax
![CTA-BUTTON]{Button Label}[https://url.com]
![IMAGE-alt text][https://image-url.com]
!![IMAGE-CAR]{alt1}{alt2}[url1][url2]`;

function ChangelogCMS() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...EMPTY_ENTRY });
  const [editingVersion, setEditingVersion] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    fetch("/api/dev/changelog", { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`Unable to load changelog (${r.status}).`); return r.json(); })
      .then((d) => { setEntries(Array.isArray(d) ? d : []); setLoading(false); })
      .catch((e) => { setLoadError(String(e)); setLoading(false); });
  }, []);

  function startNew() {
    setForm({ ...EMPTY_ENTRY });
    setEditingVersion(null);
    setSaveError(null);
    setPreview(false);
  }

  function startEdit(e: ChangelogEntry) {
    setForm({
      version: e.version,
      title: e.title,
      description: e.description,
      category: e.category ?? "",
      type: e.type ?? "update",
      content: e.content ?? "",
      image: e.image ?? "",
      imageUrl: e.imageUrl ?? "",
      ctaLabel: e.ctaLabel ?? "",
      ctaLink: e.ctaLink ?? "",
      expanded: e.expanded ?? false,
      slug: e.slug ?? "",
      large: e.large ?? false,
      showOnNextLogin: e.showOnNextLogin ?? false,
      releaseStatus:e.releaseStatus,
      published: e.published ?? true,
    });
    setEditingVersion(e.version);
    setSaveError(null);
    setPreview(false);
  }

  async function handleSave() {
    if (!form.version.trim() || !form.title.trim()) { setSaveError("Version and title are required."); return; }
    if (form.expanded && !form.slug?.trim()) { setSaveError("A slug is required for an expanded changelog page."); return; }
    if (Boolean(form.ctaLabel?.trim()) !== Boolean(form.ctaLink?.trim())) { setSaveError("A CTA needs both a label and a link."); return; }
    if (form.ctaLink?.trim() && !sanitizeUrl(form.ctaLink)) { setSaveError("Use a safe CTA URL or relative path."); return; }
    setSaving(true);
    setSaveError(null);
    const entry: ChangelogEntry = {
      date: editingVersion ? (entries.find(e => e.version === editingVersion)?.date ?? new Date().toISOString()) : new Date().toISOString(),
      ...form,
    };
    const method = editingVersion ? "PUT" : "POST";
    try {
      const res = await fetch("/api/dev/changelog", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) });
      if (!res.ok) throw new Error(`Save failed (${res.status}). Your draft is kept.`);
      const readback = await fetch("/api/dev/changelog", { cache: "no-store" });
      if (!readback.ok) throw new Error("Save returned success but could not be verified. Refresh before retrying; your draft is kept.");
      const updated = await readback.json();
      if (!Array.isArray(updated) || !updated.some((item: ChangelogEntry) => item.version === entry.version && item.title === entry.title && item.description === entry.description)) throw new Error("Saved entry was not verified. Refresh before retrying; your draft is kept.");
      setEntries(updated); startNew();
    } catch (failure) { setSaveError(failure instanceof Error ? failure.message : "Save failed. Your draft is kept."); }
    finally { setSaving(false); }
  }

  async function handleDelete(version: string) {
    if (!window.confirm(`Delete entry v${version}? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/dev/changelog", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version }) });
      if (!res.ok) { alert("Failed to delete entry."); return; }
      setEntries((prev) => prev.filter(e => e.version !== version));
      if (editingVersion === version) startNew();
    } catch {
      alert("Failed to delete entry.");
    }
  }

  const inputStyle: React.CSSProperties = { background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--card-border)", outline: "none", borderRadius: 12, padding: "8px 14px", fontSize: 14, width: "100%" };
  const cardStyle: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 16, padding: 20 };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>📝 Changelog CMS</h2>
        <button onClick={startNew} className="rounded-xl px-4 py-2 text-sm font-medium btn-interact" style={{ background: "var(--accent)", color: "#fff" }}>+ New Entry</button>
      </div>

      {/* Formatting guide (closed by default) */}
      <div style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 16 }}>
        <button
          onClick={() => setGuideOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm btn-interact"
          style={{ color: "var(--foreground)" }}
        >
          <span className="font-medium">📖 Formatting Guide</span>
          <span style={{ opacity: 0.5, fontSize: 11 }}>{guideOpen ? "▲" : "▼"}</span>
        </button>
        {guideOpen && (
          <div className="px-5 pb-5">
            <MarkdownRenderer
              content={SKY_MARKDOWN_GUIDE}
              className="text-xs leading-relaxed"
              style={{ color: "var(--foreground)", opacity: 0.8 }}
            />
          </div>
        )}
      </div>

      {/* Form */}
      <div style={cardStyle} className="space-y-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{editingVersion ? `Editing v${editingVersion}` : "Create New Entry"}</span>
          <div className="flex gap-2">
            <button onClick={() => setPreview(false)} className="text-xs rounded-lg px-3 py-1 btn-interact" style={{ background: preview ? "transparent" : "var(--accent)", color: preview ? "var(--foreground)" : "#fff" }}>Edit</button>
            <button onClick={() => setPreview(true)} className="text-xs rounded-lg px-3 py-1 btn-interact" style={{ background: preview ? "var(--accent)" : "transparent", color: preview ? "#fff" : "var(--foreground)" }}>Preview</button>
          </div>
        </div>
        {preview ? (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}
          >
            {(form.image || form.imageUrl) && (
              <div
                style={{ height: 160, backgroundImage: `url(${form.image || form.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
                aria-hidden="true"
              />
            )}
            <div className="p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded-lg" style={{ background: "var(--card)", color: "var(--foreground)", opacity: 0.7 }}>
                  v{form.version || "0.0.0"}
                </span>
                {form.category && (
                  <span className="text-xs px-2 py-0.5 rounded-lg font-medium" style={{ background: "var(--accent)", color: "#fff", opacity: 0.85 }}>
                    {form.category}
                  </span>
                )}
                {form.large && (
                  <span className="text-xs px-2 py-0.5 rounded-lg" style={{ background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--card-border)" }}>
                    📰 Full Post
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{form.title || "(no title)"}</p>
              {form.description && (
                <p className="text-xs leading-relaxed" style={{ color: "var(--foreground)", opacity: 0.65 }}>{form.description}</p>
              )}
              {form.content && (
                <MarkdownRenderer
                  content={form.content}
                  className="text-xs leading-relaxed mt-2"
                  style={{ color: "var(--foreground)", opacity: 0.75 }}
                />
              )}
              {form.ctaLabel && form.ctaLink && (() => {
                const safeUrl = sanitizeUrl(form.ctaLink);
                return (
                  <div className="pt-1">
                    {safeUrl ? (
                      <a
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block rounded-xl px-4 py-2 text-xs font-medium"
                        style={{ background: "var(--accent)", color: "#fff" }}
                      >
                        {form.ctaLabel}
                      </a>
                    ) : (
                      <span className="inline-block rounded-xl px-4 py-2 text-xs font-medium" style={{ background: "var(--accent)", color: "#fff", opacity: 0.6 }}>
                        {form.ctaLabel} <span style={{ fontSize: "10px" }}>(invalid URL)</span>
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex gap-2">
              <input
                value={form.version}
                onChange={e => !editingVersion && setForm(f => ({ ...f, version: e.target.value }))}
                readOnly={Boolean(editingVersion)}
                aria-readonly={Boolean(editingVersion)}
                placeholder="Version (e.g. 2.9.0)"
                style={{ ...inputStyle, flex: "0 0 40%", opacity: editingVersion ? 0.6 : 1, cursor: editingVersion ? "not-allowed" : "text" }}
              />
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title" style={{ ...inputStyle, flex: 1 }} />
            </div>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description (plain text summary)" rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Full Markdown content (supports Sky custom syntax — see Formatting Guide)" rows={7} style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 13 }} />
            <div className="flex gap-2">
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Category (e.g. ✨ Feature)" style={{ ...inputStyle, flex: 1 }} />
              <select
                value={form.type ?? "update"}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as "update" | "post" }))}
                style={{ ...inputStyle, flex: "0 0 120px", cursor: "pointer" }}
              >
                <option value="update">update</option>
                <option value="post">post</option>
              </select>
            </div>
            <input value={form.image || form.imageUrl} onChange={e => setForm(f => ({ ...f, image: e.target.value, imageUrl: e.target.value }))} placeholder="Header image URL (optional)" style={inputStyle} />
            <div className="flex gap-2">
              <input value={form.ctaLabel} onChange={e => setForm(f => ({ ...f, ctaLabel: e.target.value }))} placeholder="CTA Label (optional)" style={{ ...inputStyle, flex: 1 }} />
              <input value={form.ctaLink} onChange={e => setForm(f => ({ ...f, ctaLink: e.target.value }))} placeholder="CTA Link (optional)" style={{ ...inputStyle, flex: 1 }} />
            </div>
            <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="Slug (optional, e.g. my-changelog-post)" style={inputStyle} />
            <label className="text-sm">Deployment status<select value={form.releaseStatus??""} onChange={e=>setForm(f=>({...f,releaseStatus:e.target.value?e.target.value as "development"|"released":undefined}))} style={inputStyle}><option value="">Not classified</option><option value="development">In development · not deployed</option><option value="released">Released · verify deployment first</option></select></label>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.large} onChange={e => setForm(f => ({ ...f, large: e.target.checked }))} />
                <span className="text-xs" style={{ color: "var(--foreground)" }}>Large (modal)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.expanded} onChange={e => setForm(f => ({ ...f, expanded: e.target.checked }))} />
                <span className="text-xs" style={{ color: "var(--foreground)" }}>Expanded (slug page)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.showOnNextLogin} onChange={e => setForm(f => ({ ...f, showOnNextLogin: e.target.checked }))} />
                <span className="text-xs" style={{ color: "var(--foreground)" }}>Show on next login</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.published} onChange={e => setForm(f => ({ ...f, published: e.target.checked }))} />
                <span className="text-xs" style={{ color: "var(--foreground)" }}>Published</span>
              </label>
            </div>
            {saveError && <p className="text-xs" style={{ color: "#ff3b30" }}>{saveError}</p>}
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="rounded-xl px-5 py-2 text-sm font-semibold btn-interact" style={{ background: "var(--accent)", color: "#fff" }}>{saving ? "Saving…" : editingVersion ? "Update Entry" : "Create Entry"}</button>
              {editingVersion && <button onClick={startNew} className="rounded-xl px-4 py-2 text-sm btn-interact" style={{ color: "var(--foreground)", border: "1px solid var(--card-border)" }}>Cancel</button>}
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div style={cardStyle} className="space-y-2">
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--foreground)", opacity: 0.5 }}>EXISTING ENTRIES ({entries.length})</p>
        {loading && <p className="text-sm" style={{ color: "var(--foreground)", opacity: 0.5 }}>Loading…</p>}
        {loadError && <p className="text-xs" style={{ color: "#ff3b30" }}>Failed to load: {loadError}</p>}
        {!loading && entries.map((e) => (
          <div key={e.version} className="flex items-start justify-between gap-2 rounded-xl px-3 py-2.5" style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                v{e.version} · {e.title}
                {e.large && <span className="ml-1 text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--accent)", color: "#fff" }}>large</span>}
                {e.showOnNextLogin && <span className="ml-1 text-xs px-1.5 py-0.5 rounded" style={{ background: "#ff9500", color: "#fff" }}>login popup</span>}
                {!e.published && <span className="ml-1 text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--card-border)", color: "var(--foreground)" }}>draft</span>}
              </p>
              <p className="text-xs truncate" style={{ color: "var(--foreground)", opacity: 0.5 }}>{e.date.slice(0, 10)} — {e.description.slice(0, 80)}{e.description.length > 80 ? "…" : ""}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => startEdit(e)} className="text-xs rounded-lg px-2.5 py-1 btn-interact" style={{ color: "var(--foreground)", border: "1px solid var(--card-border)" }}>Edit</button>
              <button onClick={() => handleDelete(e.version)} className="text-xs rounded-lg px-2.5 py-1 btn-interact" style={{ color: "#ff3b30", border: "1px solid var(--card-border)" }}>Delete</button>
            </div>
          </div>
        ))}
        {!loading && !entries.length && <p className="text-sm" style={{ color: "var(--foreground)", opacity: 0.4 }}>No entries yet.</p>}
      </div>
    </div>
  );
}
