"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type User = {
  id: string; name: string | null; email: string | null; plan: "free" | "pro" | "dev"; joinedAt: string | null; pendingDeletion: boolean; feedbackCount: number; totalAiUses: number; credits: number;
  usage: { ai_uses: number } | null; apiKeys: unknown[];
  controls: { app_blocked: boolean; api_blocked: boolean; app_daily_ai_limit: number | null; api_rate_limit_per_min: number | null } | null;
};
type SortKey = "joinedAt" | "usage" | "plan" | "feedback" | "pendingDeletion";

function errorMessage(data: unknown, fallback: string): string {
  return typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : fallback;
}

export default function DevUsers() {
  const [users, setUsers] = useState<User[]>([]); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(""); const [sort, setSort] = useState<SortKey>("joinedAt"); const [descending, setDescending] = useState(true);
  const load = useCallback(async () => { setLoading(true); const res = await fetch("/api/dev/users"); const data = await res.json().catch(() => ({})); if (!res.ok) setError(errorMessage(data, "Unable to load users.")); else { setUsers(Array.isArray(data) ? data : []); setError(null); } setLoading(false); }, []);
  useEffect(() => { void load(); }, [load]);
  async function updateUser(user: User, change: Record<string, unknown>) { const res = await fetch("/api/dev/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, ...change }) }); if (!res.ok) { setError(errorMessage(await res.json().catch(() => ({})), "User update failed.")); return; } void load(); }
  async function exportUser(user: User) {
    if (!window.confirm(`Download all stored data for ${user.email || user.name || "this user"}? This action is logged.`)) return;
    const res = await fetch(`/api/dev/users/${user.id}/export`);
    if (!res.ok) { setError(errorMessage(await res.json().catch(() => ({})), "User export failed.")); return; }
    const blob = await res.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `skystyle-user-data-${user.id.slice(0, 8)}.json`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }
  async function deleteUser(user: User) {
    if (!user.email) { setError("This user has no email address available for safe deletion confirmation."); return; }
    const confirmation = window.prompt(`This permanently deletes the account and application data. Type this email to confirm:\n${user.email}`);
    if (confirmation === null) return;
    const res = await fetch("/api/dev/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, confirmation }) });
    if (!res.ok) { setError(errorMessage(await res.json().catch(() => ({})), "Account deletion failed.")); return; }
    void load();
  }
  const visibleUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const planScore = { free: 1, pro: 2, dev: 3 } as const;
    const value = (user: User): number => sort === "joinedAt" ? (user.joinedAt ? Date.parse(user.joinedAt) : 0) : sort === "usage" ? user.totalAiUses : sort === "plan" ? planScore[user.plan] : sort === "feedback" ? user.feedbackCount : user.pendingDeletion ? 1 : 0;
    return users.filter((user) => !needle || `${user.name ?? ""} ${user.email ?? ""}`.toLowerCase().includes(needle)).sort((a, b) => (value(a) - value(b)) * (descending ? -1 : 1));
  }, [users, query, sort, descending]);
  return <section className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Users</h1><p className="mt-1 text-sm" style={{ color: "var(--foreground)", opacity: .58 }}>Search, order, manage access, export data, or delete non-developer accounts.</p></div><button onClick={() => void load()} className="rounded-lg px-3 py-2 text-sm" style={{ border: "1px solid var(--card-border)", color: "var(--foreground)" }}>Refresh</button></div>
    {error && <p className="text-sm" style={{ color: "#ff453a" }}>{error}</p>}
    <div className="flex flex-wrap gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--card-border)" }} /><label className="text-xs" style={{ color: "var(--foreground)" }}>Order by <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="ml-1 rounded p-2" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}><option value="joinedAt">Join date</option><option value="usage">Usage</option><option value="plan">Plan</option><option value="feedback">Feedback</option><option value="pendingDeletion">Pending deletion</option></select></label><button onClick={() => setDescending((value) => !value)} className="rounded-lg px-3 py-2 text-xs" style={{ border: "1px solid var(--card-border)", color: "var(--foreground)" }}>{descending ? "Descending" : "Ascending"}</button></div>
    <p className="text-xs" style={{ color: "var(--foreground)", opacity: .55 }}>{visibleUsers.length} users shown · destructive and export actions are audited.</p>
    {loading ? <p style={{ color: "var(--foreground)", opacity: .55 }}>Loading users…</p> : visibleUsers.map((user) => <article className="rounded-xl p-4 space-y-3" key={user.id} style={{ background: "var(--card)", border: "1px solid var(--card-border)", color: "var(--foreground)" }}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">{user.name || user.email || user.id}</h2>{user.name && user.email && <p className="text-xs opacity-60">{user.email}</p>}<p className="mt-1 text-xs opacity-60">Plan: {user.plan} · Joined: {user.joinedAt ? new Date(user.joinedAt).toLocaleDateString() : "Not recorded"} · AI total: {user.totalAiUses} · Today: {user.usage?.ai_uses ?? 0} · Feedback: {user.feedbackCount} · App credits: {user.credits} · API keys: {user.apiKeys.length}</p></div><div className="flex gap-2"><span className="rounded-full px-2 py-1 text-xs" style={{ background: user.pendingDeletion ? "#ff950033" : "var(--background)" }}>{user.pendingDeletion ? "Pending deletion" : "Active"}</span>{user.controls?.app_blocked && <span className="rounded-full px-2 py-1 text-xs" style={{ background: "#ff453a33" }}>App blocked</span>}{user.controls?.api_blocked && <span className="rounded-full px-2 py-1 text-xs" style={{ background: "#ff453a33" }}>API blocked</span>}</div></div><div className="flex flex-wrap gap-2"><button onClick={() => void updateUser(user, { appBlocked: !user.controls?.app_blocked })} className="rounded-lg px-2 py-1 text-xs" style={{ border: "1px solid var(--card-border)" }}>{user.controls?.app_blocked ? "Unblock app" : "Block app"}</button><button onClick={() => void updateUser(user, { apiBlocked: !user.controls?.api_blocked })} className="rounded-lg px-2 py-1 text-xs" style={{ border: "1px solid var(--card-border)" }}>{user.controls?.api_blocked ? "Unblock API" : "Block API"}</button><button onClick={() => void updateUser(user, { giftAppCredits: 5 })} className="rounded-lg px-2 py-1 text-xs" style={{ border: "1px solid var(--card-border)" }}>Gift 5 credits</button><button onClick={() => void exportUser(user)} className="rounded-lg px-2 py-1 text-xs" style={{ border: "1px solid var(--card-border)" }}>Download data</button>{user.plan !== "dev" && <button onClick={() => void deleteUser(user)} className="rounded-lg px-2 py-1 text-xs" style={{ border: "1px solid #ff453a", color: "#ff453a" }}>Delete account</button>}<label className="text-xs">App AI/day <input aria-label="App daily AI limit" type="number" min="0" defaultValue={user.controls?.app_daily_ai_limit ?? ""} onBlur={(event) => event.currentTarget.value !== "" && void updateUser(user, { appDailyAiLimit: Number(event.currentTarget.value) })} className="ml-1 w-14 rounded p-1" style={{ background: "var(--background)", border: "1px solid var(--card-border)" }} /></label><label className="text-xs">API/min <input aria-label="API per-minute limit" type="number" min="0" defaultValue={user.controls?.api_rate_limit_per_min ?? ""} onBlur={(event) => event.currentTarget.value !== "" && void updateUser(user, { apiRateLimitPerMin: Number(event.currentTarget.value) })} className="ml-1 w-14 rounded p-1" style={{ background: "var(--background)", border: "1px solid var(--card-border)" }} /></label></div></article>)}
    {!loading && visibleUsers.length === 0 && <p className="text-sm" style={{ color: "var(--foreground)", opacity: .55 }}>No users match the current filters.</p>}
  </section>;
}
