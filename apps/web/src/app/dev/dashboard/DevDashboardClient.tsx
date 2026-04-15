"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import MarkdownRenderer from "@/components/MarkdownRenderer";

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
    if (section === "triage") { void (async () => fetchDeletion())(); }
  }, [section, fetchDeletion]);

  useEffect(() => {
    if (selectedUserId) { void (async () => fetchChat(selectedUserId))(); }
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

interface ChangelogEntry {
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
  published: true,
};

const SKY_MARKDOWN_GUIDE = `## Standard Markdown
**bold**, *italic*, ~~strikethrough~~, \`code\`
[Link text](https://url.com)
# H1  ## H2  ### H3  #### H4
> Blockquote
- Unordered list item
1. Ordered list item
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
    fetch("/api/dev/changelog")
      .then((r) => r.json())
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
      published: e.published ?? true,
    });
    setEditingVersion(e.version);
    setSaveError(null);
    setPreview(false);
  }

  async function handleSave() {
    if (!form.version.trim() || !form.title.trim()) { setSaveError("Version and title are required."); return; }
    setSaving(true);
    setSaveError(null);
    const entry: ChangelogEntry = {
      date: editingVersion ? (entries.find(e => e.version === editingVersion)?.date ?? new Date().toISOString()) : new Date().toISOString(),
      ...form,
    };
    const method = editingVersion ? "PUT" : "POST";
    const res = await fetch("/api/dev/changelog", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSaveError((body as { error?: string }).error ?? "Failed to save.");
      setSaving(false);
      return;
    }
    const updated = await fetch("/api/dev/changelog").then(r => r.json());
    setEntries(Array.isArray(updated) ? updated : entries);
    startNew();
    setSaving(false);
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
            {form.image && (
              <div
                style={{ height: 160, backgroundImage: `url(${form.image})`, backgroundSize: "cover", backgroundPosition: "center" }}
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
                const safeUrl = form.ctaLink.match(/^https?:\/\//) ? form.ctaLink : null;
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
            <input value={form.image} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} placeholder="Header image URL (optional)" style={inputStyle} />
            <div className="flex gap-2">
              <input value={form.ctaLabel} onChange={e => setForm(f => ({ ...f, ctaLabel: e.target.value }))} placeholder="CTA Label (optional)" style={{ ...inputStyle, flex: 1 }} />
              <input value={form.ctaLink} onChange={e => setForm(f => ({ ...f, ctaLink: e.target.value }))} placeholder="CTA Link (optional)" style={{ ...inputStyle, flex: 1 }} />
            </div>
            <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="Slug (optional, e.g. my-changelog-post)" style={inputStyle} />
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
