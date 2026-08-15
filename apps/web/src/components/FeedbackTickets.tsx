"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

type Ticket = { id: string; category: string; rating: number; comment: string | null; status: string; created_at: string; updated_at: string; source?: string; sender?: { name: string | null; email: string | null } };
type Reply = { id: string; feedback_id: string; from_dev: boolean; body: string; created_at: string };
type FeedbackSort = "recent" | "oldest" | "rating" | "status" | "source" | "sender";

export default function FeedbackTickets({ devMode = false }: { devMode?: boolean }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<FeedbackSort>("recent");
  const load = useCallback(async () => {
    const res = await fetch("/api/feedback/tickets");
    if (!res.ok) { setError("Unable to load feedback conversations."); return; }
    const data = await res.json(); setTickets(data.tickets ?? []); setReplies(data.replies ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const sortedTickets = useMemo(() => [...tickets].sort((a, b) => {
    if (sort === "oldest") return Date.parse(a.created_at) - Date.parse(b.created_at);
    if (sort === "rating") return b.rating - a.rating || Date.parse(b.updated_at) - Date.parse(a.updated_at);
    if (sort === "status") return a.status.localeCompare(b.status) || Date.parse(b.updated_at) - Date.parse(a.updated_at);
    if (sort === "source") return (a.source ?? "").localeCompare(b.source ?? "") || Date.parse(b.updated_at) - Date.parse(a.updated_at);
    if (sort === "sender") return `${a.sender?.name ?? ""}${a.sender?.email ?? ""}`.localeCompare(`${b.sender?.name ?? ""}${b.sender?.email ?? ""}`) || Date.parse(b.updated_at) - Date.parse(a.updated_at);
    return Date.parse(b.updated_at) - Date.parse(a.updated_at);
  }), [tickets, sort]);
  async function reply(ticketId: string) {
    const message = drafts[ticketId]?.trim(); if (!message) return;
    const res = await fetch("/api/feedback/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId, message }) });
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "Reply failed."); return; }
    setDrafts((value) => ({ ...value, [ticketId]: "" })); void load();
  }
  async function close(ticketId: string) {
    const res = await fetch("/api/feedback/tickets", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId, action: "close" }) });
    if (!res.ok) { setError("Unable to close the ticket."); return; } void load();
  }
  return <section className="space-y-3">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>{devMode ? "Feedback tickets" : "Your feedback conversations"}</h2><p className="text-xs mt-1" style={{ color: "var(--foreground)", opacity: .55 }}>Replies arrive in Inbox too. Either side can continue the Markdown-enabled thread or close it.</p></div>{devMode && <label className="text-xs" style={{ color: "var(--foreground)" }}>Sort <select value={sort} onChange={(event) => setSort(event.target.value as FeedbackSort)} className="ml-1 rounded p-2" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}><option value="recent">Recently updated</option><option value="oldest">Oldest first</option><option value="rating">Highest rating</option><option value="status">Status</option><option value="source">Source</option><option value="sender">Sender</option></select></label>}</div>
    {error && <p className="text-xs" style={{ color: "#ff453a" }}>{error}</p>}
    {!tickets.length && <p className="text-sm" style={{ color: "var(--foreground)", opacity: .55 }}>No conversations yet.</p>}
    {sortedTickets.map((ticket) => <article key={ticket.id} className="rounded-xl p-4 space-y-3" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
      <div className="flex justify-between gap-3"><div><p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{ticket.category} · {ticket.rating}/5</p>{devMode && <p className="text-xs mt-1" style={{ color: "var(--foreground)", opacity: .58 }}>From {ticket.sender?.name || ticket.sender?.email || "Unknown user"}{ticket.sender?.email && ticket.sender?.name ? ` (${ticket.sender.email})` : ""} · {ticket.source || "Unknown source"} · {new Date(ticket.created_at).toLocaleString()}</p>}<div className="prose prose-sm mt-1 max-w-none break-words text-xs" style={{ color: "var(--foreground)", opacity: .72 }}><ReactMarkdown>{ticket.comment || "No written comment"}</ReactMarkdown></div></div><span className="text-xs capitalize" style={{ color: "var(--accent)" }}>{ticket.status.replace("_", " ")}</span></div>
      <div className="space-y-2">{replies.filter((reply) => reply.feedback_id === ticket.id).map((reply) => <div key={reply.id} className="rounded-lg p-3 text-sm" style={{ background: reply.from_dev ? "color-mix(in srgb, var(--accent) 12%, var(--background))" : "var(--background)", color: "var(--foreground)" }}><p className="mb-1 text-xs font-semibold opacity-60">{reply.from_dev ? "Sky Style" : "You"} · {new Date(reply.created_at).toLocaleString()}</p><div className="prose prose-sm max-w-none break-words" style={{ color: "var(--foreground)" }}><ReactMarkdown>{reply.body}</ReactMarkdown></div></div>)}</div>
      {ticket.status !== "closed" && <><textarea value={drafts[ticket.id] ?? ""} onChange={(event) => setDrafts((value) => ({ ...value, [ticket.id]: event.target.value }))} placeholder="Write a reply…" className="w-full rounded-lg p-2 text-sm" style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--card-border)" }} /><div className="flex gap-2"><button onClick={() => void reply(ticket.id)} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: "var(--accent)", color: "white" }}>Send reply</button><button onClick={() => void close(ticket.id)} className="rounded-lg px-3 py-1.5 text-xs" style={{ color: "var(--foreground)", border: "1px solid var(--card-border)" }}>Close</button></div></>}
    </article>)}
  </section>;
}
