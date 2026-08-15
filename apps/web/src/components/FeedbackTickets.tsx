"use client";

import { useCallback, useEffect, useState } from "react";

type Ticket = { id: string; category: string; rating: number; comment: string | null; status: string; created_at: string; updated_at: string };
type Reply = { id: string; feedback_id: string; from_dev: boolean; body: string; created_at: string };

export default function FeedbackTickets({ devMode = false }: { devMode?: boolean }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const res = await fetch("/api/feedback/tickets");
    if (!res.ok) { setError("Unable to load feedback conversations."); return; }
    const data = await res.json(); setTickets(data.tickets ?? []); setReplies(data.replies ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
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
    <div><h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>{devMode ? "Feedback tickets" : "Your feedback conversations"}</h2><p className="text-xs mt-1" style={{ color: "var(--foreground)", opacity: .55 }}>Replies arrive in Inbox too. Either side can close a conversation.</p></div>
    {error && <p className="text-xs" style={{ color: "#ff453a" }}>{error}</p>}
    {!tickets.length && <p className="text-sm" style={{ color: "var(--foreground)", opacity: .55 }}>No conversations yet.</p>}
    {tickets.map((ticket) => <article key={ticket.id} className="rounded-xl p-4 space-y-3" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
      <div className="flex justify-between gap-3"><div><p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{ticket.category} · {ticket.rating}/5</p><p className="text-xs mt-1" style={{ color: "var(--foreground)", opacity: .58 }}>{ticket.comment || "No written comment"}</p></div><span className="text-xs capitalize" style={{ color: "var(--accent)" }}>{ticket.status.replace("_", " ")}</span></div>
      {replies.filter((reply) => reply.feedback_id === ticket.id).map((reply) => <div key={reply.id} className="rounded-lg p-2 text-xs" style={{ background: "var(--background)", color: "var(--foreground)" }}><b>{reply.from_dev ? "Sky Style" : "You"}:</b> {reply.body}</div>)}
      {ticket.status !== "closed" && <><textarea value={drafts[ticket.id] ?? ""} onChange={(event) => setDrafts((value) => ({ ...value, [ticket.id]: event.target.value }))} placeholder="Write a reply…" className="w-full rounded-lg p-2 text-sm" style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--card-border)" }} /><div className="flex gap-2"><button onClick={() => void reply(ticket.id)} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: "var(--accent)", color: "white" }}>Send reply</button><button onClick={() => void close(ticket.id)} className="rounded-lg px-3 py-1.5 text-xs" style={{ color: "var(--foreground)", border: "1px solid var(--card-border)" }}>Close</button></div></>}
    </article>)}
  </section>;
}
