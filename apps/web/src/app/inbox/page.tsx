"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageSpacingWrapper from "@/components/PageSpacingWrapper";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import useClothingInventory from "@/components/useClothingInventory";

const CATEGORY_LABELS: Record<string, string> = { recommendation: "Recommendations", support: "Support messages", changelog: "Changelog", system: "System notices", warning: "Warnings", error: "Errors" };

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
  const [busy, setBusy] = useState(false);
  const inventory = useClothingInventory();
  async function perform(work: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await work(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "The change could not be saved. Please retry."); }
    finally { setBusy(false); }
  }

  const load = useCallback(async () => {
    const res = await fetch("/api/inbox");
    if (!res.ok) throw new Error("Unable to load inbox.");
    const data = await res.json();
    setMessages(Array.isArray(data.messages) ? data.messages : []);
    setBrowserNotifications(data.preferences?.browser_notifications === true);
    setMutedCategories(Array.isArray(data.preferences?.muted_categories) ? data.preferences.muted_categories : []);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load inbox.")).finally(() => setLoading(false));
    });
  }, [load]);

  async function updateMessage(messageId: string, updates: Record<string, unknown>) {
    const res = await fetch("/api/inbox", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId, ...updates }) });
    if (!res.ok) throw new Error("Unable to update message. Please retry.");
    setMessages((current) => current.filter((message) => updates.dismissed === true ? message.id !== messageId : true).map((message) => message.id === messageId ? { ...message, read_at: new Date().toISOString() } : message));
  }

  async function updateBrowserNotifications(enabled: boolean) {
    if (enabled && !("Notification" in window)) throw new Error("This browser does not support notifications. You can still read updates here.");
    if (enabled) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Browser notification permission was not granted.");
    }
    const res = await fetch("/api/inbox", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preferences: { browserNotifications: enabled, mutedCategories } }) });
    if (!res.ok) throw new Error("Unable to save notification preference. Please retry.");
    setBrowserNotifications(enabled);
  }

  async function toggleMutedCategory(category: string) {
    const next = mutedCategories.includes(category) ? mutedCategories.filter((item) => item !== category) : [...mutedCategories, category];
    const res = await fetch("/api/inbox", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preferences: { browserNotifications, mutedCategories: next } }) });
    if (!res.ok) throw new Error("Unable to save notification preference. Please retry.");
    setMutedCategories(next);
  }

  const unreadCount = messages.filter((message) => !message.read_at).length;

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <PageSpacingWrapper page="inbox" className="max-w-3xl min-w-0 mx-auto space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">🔔 Inbox {unreadCount > 0 && <span className="inline-flex rounded-full px-2 py-0.5 align-middle text-xs" style={{ background: "#ff453a", color: "white" }}>{unreadCount} new</span>}</h1><p className="text-sm opacity-60">Recommendations, support updates, and system notices.</p></div><Link href="/dashboard" className="control-button text-sm" style={{ border: "1px solid var(--card-border)" }}>Back</Link></div>
        <label className="rounded-2xl p-4 flex items-center justify-between gap-4" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}><span><strong className="text-sm">Browser notifications</strong><span className="block text-xs opacity-55 mt-1">Enable notifications for ready automatic recommendations and errors.</span></span><input type="checkbox" checked={browserNotifications} disabled={busy || loading} onChange={(event) => { const enabled = event.target.checked; void perform(() => updateBrowserNotifications(enabled)); }} /></label>
        <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}><p className="text-sm font-semibold">Notification categories</p><div className="flex flex-wrap gap-3 mt-3">{["recommendation", "support", "changelog", "system", "warning", "error"].map((category) => <label key={category} className="min-h-11 text-xs capitalize flex gap-2 items-center"><input type="checkbox" checked={!mutedCategories.includes(category)} disabled={busy || loading} onChange={() => void perform(() => toggleMutedCategory(category))} /> {CATEGORY_LABELS[category]}</label>)}</div></div>
        {error && <div role="alert" className="text-sm"><p>{error}</p><button type="button" disabled={busy} onClick={() => void perform(load)} className="control-button underline">Refresh inbox</button></div>}
        {inventory.error && <p className="text-sm">{inventory.error} <button type="button" onClick={inventory.retry} className="control-button underline">Retry closet</button></p>}
        {loading ? <p className="text-sm opacity-50">Loading inbox…</p> : messages.length === 0 ? !error && <p className="text-sm opacity-50">Your inbox is clear.</p> : <div className="space-y-3">{messages.map((message) => <article key={message.id} className="min-w-0 rounded-2xl p-4 space-y-2" style={{ background: "var(--card)", border: `1px solid ${message.read_at ? "var(--card-border)" : "var(--accent)"}`, opacity: message.read_at ? 0.7 : 1 }}><div className="flex flex-wrap justify-between gap-2"><h2 className="break-words text-sm font-semibold">{!message.read_at && <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: "#ff453a" }} aria-label="Unread" />}{message.title}</h2><time className="text-xs opacity-50">{new Date(message.created_at).toLocaleString()}</time></div><MarkdownRenderer content={message.body} className="text-sm break-words" closetItems={message.category === "recommendation" ? inventory.items : []} wardrobeItems={inventory.wardrobeItems} recommendationLinks={message.category === "recommendation" && !inventory.loading && !inventory.error} /><div className="flex flex-wrap gap-3 text-xs"><button disabled={busy || !!message.read_at} onClick={() => void perform(() => updateMessage(message.id, { read: true }))} className="control-button underline">{message.read_at ? "Read" : "Mark read"}</button>{message.category === "support" && typeof message.metadata.ticketId === "string" && <Link href={`/feedback?ticket=${encodeURIComponent(message.metadata.ticketId)}`} className="control-button underline" onClick={() => { if (!busy) void perform(() => updateMessage(message.id, { read: true })); }}>Reply in thread</Link>}<button disabled={busy} onClick={() => void perform(() => updateMessage(message.id, { dismissed: true }))} className="control-button underline">Dismiss</button></div></article>)}</div>}
      </PageSpacingWrapper>
    </main>
  );
}
