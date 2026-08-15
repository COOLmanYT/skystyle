"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageSpacingWrapper from "@/components/PageSpacingWrapper";

interface InboxMessage {
  id: string;
  category: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export default function InboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [browserNotifications, setBrowserNotifications] = useState(false);
  const [mutedCategories, setMutedCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/inbox");
    if (!res.ok) throw new Error("Unable to load inbox.");
    const data = await res.json();
    setMessages(Array.isArray(data.messages) ? data.messages : []);
    setBrowserNotifications(data.preferences?.browser_notifications === true);
    setMutedCategories(Array.isArray(data.preferences?.muted_categories) ? data.preferences.muted_categories : []);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load inbox.")).finally(() => setLoading(false));
  }, [load]);

  async function updateMessage(messageId: string, updates: Record<string, unknown>) {
    const res = await fetch("/api/inbox", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId, ...updates }) });
    if (!res.ok) return setError("Unable to update message.");
    setMessages((current) => current.filter((message) => updates.dismissed === true ? message.id !== messageId : true).map((message) => message.id === messageId ? { ...message, read_at: new Date().toISOString() } : message));
  }

  async function updateBrowserNotifications(enabled: boolean) {
    if (enabled && "Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setError("Browser notification permission was not granted.");
    }
    const res = await fetch("/api/inbox", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preferences: { browserNotifications: enabled, mutedCategories } }) });
    if (!res.ok) return setError("Unable to save notification preference.");
    setBrowserNotifications(enabled);
  }

  async function toggleMutedCategory(category: string) {
    const next = mutedCategories.includes(category) ? mutedCategories.filter((item) => item !== category) : [...mutedCategories, category];
    const res = await fetch("/api/inbox", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preferences: { browserNotifications, mutedCategories: next } }) });
    if (!res.ok) return setError("Unable to save notification preference.");
    setMutedCategories(next);
  }

  const unreadCount = messages.filter((message) => !message.read_at).length;

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <PageSpacingWrapper page="inbox" className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">🔔 Inbox {unreadCount > 0 && <span className="inline-flex rounded-full px-2 py-0.5 align-middle text-xs" style={{ background: "#ff453a", color: "white" }}>{unreadCount} new</span>}</h1><p className="text-sm opacity-60">Recommendations, support updates, and system notices.</p></div><Link href="/dashboard" className="text-sm rounded-xl px-3 py-2" style={{ border: "1px solid var(--card-border)" }}>Back</Link></div>
        <label className="rounded-2xl p-4 flex items-center justify-between gap-4" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}><span><strong className="text-sm">Browser notifications</strong><span className="block text-xs opacity-55 mt-1">Enable notifications for ready automatic recommendations and errors.</span></span><input type="checkbox" checked={browserNotifications} onChange={(event) => updateBrowserNotifications(event.target.checked)} /></label>
        <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}><p className="text-sm font-semibold">Mute notification categories</p><div className="flex flex-wrap gap-3 mt-3">{["recommendation", "support", "changelog", "system", "warning", "error"].map((category) => <label key={category} className="text-xs capitalize flex gap-1.5 items-center"><input type="checkbox" checked={!mutedCategories.includes(category)} onChange={() => void toggleMutedCategory(category)} /> {category}</label>)}</div></div>
        {error && <p role="alert" className="text-sm" style={{ color: "#ff3b30" }}>{error}</p>}
        {loading ? <p className="text-sm opacity-50">Loading inbox…</p> : messages.length === 0 ? <p className="text-sm opacity-50">Your inbox is clear.</p> : <div className="space-y-3">{messages.map((message) => <article key={message.id} className="rounded-2xl p-4 space-y-2" style={{ background: "var(--card)", border: `1px solid ${message.read_at ? "var(--card-border)" : "var(--accent)"}`, opacity: message.read_at ? 0.7 : 1 }}><div className="flex justify-between gap-2"><h2 className="text-sm font-semibold">{!message.read_at && <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: "#ff453a" }} aria-label="Unread" />}{message.title}</h2><time className="text-xs opacity-50">{new Date(message.created_at).toLocaleString()}</time></div><p className="text-sm whitespace-pre-wrap">{message.body}</p><div className="flex gap-3 text-xs"><button onClick={() => updateMessage(message.id, { read: true })} className="underline">Mark read</button>{message.category === "support" && typeof message.metadata.ticketId === "string" && <Link href={`/feedback?ticket=${encodeURIComponent(message.metadata.ticketId)}`} className="underline" onClick={() => void updateMessage(message.id, { read: true })}>Reply in thread</Link>}<button onClick={() => updateMessage(message.id, { dismissed: true })} className="underline">Dismiss</button></div></article>)}</div>}
      </PageSpacingWrapper>
    </main>
  );
}
