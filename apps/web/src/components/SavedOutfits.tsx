"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OutfitActions from "./OutfitActions";
import MarkdownRenderer from "./MarkdownRenderer";
import useClothingInventory from "./useClothingInventory";
import useByokCredentials from "./useByokCredentials";
import type { SavedOutfit } from "@/lib/outfits";
import { DEMO_USER_ID } from "@/lib/demo";
export default function SavedOutfits({ userId }: { userId: string }) {
  const credentials = useByokCredentials(userId), inventory = useClothingInventory();
  const [outfits, setOutfits] = useState<SavedOutfit[]>([]), [active, setActive] = useState<SavedOutfit | null>(null);
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [deleting, setDeleting] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/outfits");
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.outfits)) throw new Error(data.error || "Could not load saved outfits.");
      setOutfits(data.outfits); setError("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not load saved outfits. Please retry."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { let current = true; queueMicrotask(() => { if (current) void load(); }); return () => { current = false; }; }, [load]);
  async function remove(outfit: SavedOutfit) {
    if (!window.confirm(`Delete ${outfit.title}?`)) return;
    setDeleting(outfit.id); setError("");
    try {
      const response = await fetch("/api/outfits", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: outfit.id, revision: outfit.revision }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete outfit. Please retry.");
      setOutfits(previous => previous.filter(value => value.id !== outfit.id));
      setActive(previous => previous?.id === outfit.id ? null : previous);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not delete outfit. Please retry."); }
    finally { setDeleting(null); }
  }
  const links = !inventory.loading && !inventory.error;
  return <section className="min-w-0 space-y-5">
    <h1 className="text-2xl font-semibold">Saved outfits</h1>
    <p className="text-sm opacity-70">Reuse without another AI request. Saved advice reflects the conditions when it was created.</p>
    <Link href="/dashboard" className="control-button text-sm underline">Get advice for current weather</Link>
    {error && <div role="alert"><p>{error}</p><button type="button" disabled={deleting !== null} onClick={() => void load()} className="control-button text-sm underline">Refresh saved outfits</button></div>}
    {inventory.error && <div role="status"><p className="text-sm">{inventory.error}</p><button type="button" onClick={inventory.retry} className="control-button text-sm underline">Retry closet</button></div>}
    {loading && <p role="status" className="text-sm">Loading saved outfits…</p>}
    <ul className="space-y-3">{outfits.map(outfit => <li key={outfit.id} className="min-w-0 rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
      <h2 className="break-words font-medium">{outfit.title}</h2>
      <MarkdownRenderer content={outfit.payload.outfit} className="mt-2 text-sm" closetItems={inventory.items} wardrobeItems={inventory.wardrobeItems} recommendationLinks={links} />
      <div className="mt-3 flex flex-wrap gap-2 text-sm"><button type="button" onClick={() => setActive(outfit)} className="control-button underline">Reuse / adjust</button><button type="button" disabled={deleting !== null} onClick={() => void remove(outfit)} className="control-button underline">{deleting === outfit.id ? "Deleting…" : "Delete"}</button></div>
    </li>)}</ul>
    {!loading && !outfits.length && !error && <p className="text-sm">{userId === DEMO_USER_ID ? "Demo outfits stay on the Style page. Sign out of the demo and sign in with a real account to save across devices." : "Save an outfit from Style to keep it here."}</p>}
    {active && <div className="space-y-3"><h2 className="break-words font-medium">{active.title}</h2>
      <MarkdownRenderer content={active.payload.outfit} className="text-sm" closetItems={inventory.items} wardrobeItems={inventory.wardrobeItems} recommendationLinks={links} />
      <MarkdownRenderer content={active.payload.reasoning} className="text-sm" closetItems={inventory.items} wardrobeItems={inventory.wardrobeItems} recommendationLinks={links} />
      <OutfitActions key={active.id} saved={active} apiKey={credentials.key} provider={credentials.provider} wardrobeItems={inventory.structured ? inventory.wardrobeItems : undefined} payload={active.payload}
        onChange={payload => setActive(previous => previous?.id === active.id ? { ...previous, payload } : previous)}
        onSaved={outfit => { setActive(previous => previous?.id === outfit.id ? outfit : previous); setOutfits(previous => previous.map(value => value.id === outfit.id ? outfit : value)); }} />
    </div>}
  </section>;
}
