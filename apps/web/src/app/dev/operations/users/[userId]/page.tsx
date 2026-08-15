"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

type Profile = Record<string, unknown>;

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const [data, setData] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const res = await fetch(`/api/dev/users/${userId}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) setError(typeof body.error === "string" ? body.error : "Unable to load user profile.");
    else { setData(body); setError(null); }
  }, [userId]);
  useEffect(() => { void load(); }, [load]);
  async function update(change: Record<string, unknown>) {
    const res = await fetch("/api/dev/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, ...change }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(typeof body.error === "string" ? body.error : "User update failed."); return; }
    void load();
  }
  const user = data?.user as { name?: string | null; email?: string | null; is_pro?: boolean; is_dev?: boolean } | undefined;
  const plan = user?.is_dev ? "dev" : user?.is_pro ? "pro" : "free";
  const adjust = (field: "appCreditDelta" | "moneyCreditDelta", label: string) => {
    const amount = Number(window.prompt(`${label}: positive gifts, negative revokes${field === "moneyCreditDelta" ? " (cents)" : ""}.`, "0"));
    if (Number.isInteger(amount) && amount !== 0) void update({ [field]: amount });
  };
  return <main className="min-h-screen p-4 md:p-8" style={{ background: "var(--background)", color: "var(--foreground)" }}><div className="mx-auto max-w-5xl space-y-5">
    <Link href="/dev/operations/users" className="text-sm" style={{ color: "var(--accent)" }}>← Users</Link>
    {error && <p style={{ color: "#ff453a" }}>{error}</p>}
    {!data ? <p>Loading profile…</p> : <>
      <header><h1 className="text-2xl font-bold">{user?.name || user?.email || "User profile"}</h1><p className="text-sm opacity-60">{user?.email} · {plan}</p></header>
      <section className="rounded-xl p-4 space-y-3" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}><h2 className="font-semibold">Management</h2><div className="flex flex-wrap gap-2"><select aria-label="User plan" value={plan} disabled={plan === "dev"} onChange={(event) => void update({ plan: event.target.value })} className="rounded-lg px-2 py-1 text-xs" style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}><option value="free">Free</option><option value="pro">Pro</option><option value="dev">Dev</option></select><button onClick={() => adjust("appCreditDelta", "App credits")} className="rounded-lg px-2 py-1 text-xs" style={{ border: "1px solid var(--card-border)" }}>Adjust App credits</button><button onClick={() => adjust("moneyCreditDelta", "$ credits")} className="rounded-lg px-2 py-1 text-xs" style={{ border: "1px solid var(--card-border)" }}>Adjust $ credits</button><button onClick={() => void update({ appBlocked: true })} className="rounded-lg px-2 py-1 text-xs" style={{ border: "1px solid var(--card-border)" }}>Block App</button><button onClick={() => void update({ apiBlocked: true })} className="rounded-lg px-2 py-1 text-xs" style={{ border: "1px solid var(--card-border)" }}>Block API</button><button onClick={() => void update({ clearAppBlock: true, clearApiBlock: true })} className="rounded-lg px-2 py-1 text-xs" style={{ border: "1px solid var(--card-border)" }}>Clear blocks</button>{plan !== "dev" && <button onClick={() => { const reason = window.prompt("Ban reason"); if (reason !== null) void update({ banned: true, banReason: reason, appBlocked: true, apiBlocked: true }); }} className="rounded-lg px-2 py-1 text-xs" style={{ border: "1px solid #ff9500", color: "#ff9500" }}>Ban user</button>}</div><p className="text-xs opacity-60">For a timed block, use the date-time controls in the Users list. API-key credit adjustments are listed with key IDs below.</p></section>
      <section className="grid gap-4 md:grid-cols-2">{[["Access controls", data.controls], ["Settings", data.settings], ["Closet", data.closet], ["Credit wallet", data.wallet]].map(([title, value]) => <article key={String(title)} className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}><h2 className="font-semibold">{String(title)}</h2><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(value, null, 2)}</pre></article>)}</section>
      <section className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}><h2 className="font-semibold">Chats and feedback</h2><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify({ chats: data.messages, feedback: data.feedback }, null, 2)}</pre></section>
      <section className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}><h2 className="font-semibold">Usage and API activity</h2><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify({ app: data.usage, api: data.apiUsage, keys: data.keys }, null, 2)}</pre></section>
    </>}</div></main>;
}
