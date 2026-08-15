"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DevOperationsNav from "@/components/DevOperationsNav";

type BannedUser = { id: string; name: string | null; email: string | null; controls: { banned_at?: string | null; ban_reason?: string | null } | null };

export default function BanManagementPage() {
  const [users, setUsers] = useState<BannedUser[]>([]); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { const res = await fetch("/api/dev/users"); const data = await res.json().catch(() => ({})); if (!res.ok) setError(typeof data.error === "string" ? data.error : "Unable to load bans."); else setUsers(Array.isArray(data) ? data.filter((user) => user.controls?.banned_at) : []); }, []);
  useEffect(() => { void load(); }, [load]);
  async function unban(user: BannedUser) { if (!window.confirm(`Remove the permanent ban for ${user.email || user.id}?`)) return; const res = await fetch("/api/dev/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, banned: false, clearAppBlock: true, clearApiBlock: true }) }); if (!res.ok) setError("Unable to remove ban."); else void load(); }
  return <main className="min-h-screen p-4 md:p-8" style={{ background: "var(--background)", color: "var(--foreground)" }}><div className="mx-auto max-w-5xl space-y-6"><Link href="/dev" className="text-sm" style={{ color: "var(--accent)" }}>← Dev Center</Link><DevOperationsNav current="bans" /><div><h1 className="text-2xl font-bold">Ban management</h1><p className="mt-1 text-sm opacity-60">Permanent bans block both the App and API. Removing a ban restores access controls.</p></div>{error && <p style={{ color: "#ff453a" }}>{error}</p>}{users.length === 0 ? <p className="text-sm opacity-60">No banned users.</p> : users.map((user) => <article key={user.id} className="rounded-xl p-4 flex flex-wrap items-center justify-between gap-3" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}><div><p className="font-semibold">{user.name || user.email || user.id}</p><p className="text-xs opacity-60">{user.email} · {user.controls?.banned_at ? new Date(user.controls.banned_at).toLocaleString() : ""} · {user.controls?.ban_reason || "No reason recorded"}</p></div><button onClick={() => void unban(user)} className="rounded-lg px-3 py-2 text-xs" style={{ border: "1px solid var(--card-border)" }}>Remove ban</button></article>)}</div></main>;
}
