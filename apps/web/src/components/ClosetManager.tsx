"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { WARDROBE_CATEGORIES, newWardrobeItem, type WardrobeItem, type WardrobeSnapshot } from "@/lib/wardrobe";
import { closetItemId } from "@/lib/recommendation-links";
import { readDemoWardrobe, writeDemoWardrobe } from "@/lib/demo-wardrobe";
import ClosetHighlighter from "./ClosetHighlighter";

interface Props {
  initialItems: string[];
  initialSnapshot?: WardrobeSnapshot;
  highlight?: string | null;
  temporary?: boolean;
  embedded?: boolean;
  onChange?: (snapshot: WardrobeSnapshot) => void;
}
const CATEGORY_LABELS = { top: "Top", bottom: "Bottom", "one-piece": "One-piece", outerwear: "Outerwear", footwear: "Footwear", accessory: "Accessory", other: "Other" };
export default function ClosetManager({ initialItems, initialSnapshot, highlight, temporary = false, embedded = false, onChange }: Props) {
  const [snapshot, setSnapshot] = useState<WardrobeSnapshot>(initialSnapshot ?? { items: initialItems, wardrobeItems: initialItems.map((label, index) => newWardrobeItem(`legacy-${index}`, label)), revision: 0 });
  const [draft, setDraft] = useState<WardrobeItem | null>(null);
  const [label, setLabel] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [ready, setReady] = useState(!!initialSnapshot || temporary);
  const [demoPersisted, setDemoPersisted] = useState(true);
  const addId = useRef<string | null>(null);
  const publish = useCallback((next: WardrobeSnapshot) => {
    setSnapshot(next); onChange?.(next);
    setSelected(previous => previous.filter(id => next.wardrobeItems.some(item => item.id === id)));
  }, [onChange]);
  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/wardrobe");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load your closet. Please retry.");
      publish(data); setReady(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not load your closet. Please retry."); }
  }, [publish]);
  useEffect(() => {
    if (initialSnapshot) { queueMicrotask(() => { setSnapshot(initialSnapshot); setReady(true); setSelected(previous => previous.filter(id => initialSnapshot.wardrobeItems.some(item => item.id === id))); }); }
    else if (temporary) { queueMicrotask(() => setSnapshot(readDemoWardrobe())); }
    else { void load(); }
  }, [initialSnapshot, temporary, load, publish]);
  async function save(operation: { type: "add" | "update"; item: WardrobeItem } | { type: "delete"; ids: string[] }) {
    setBusy(true); setError("");
    try {
      if (temporary) {
        const items = operation.type === "delete" ? snapshot.wardrobeItems.filter(item => !operation.ids.includes(item.id)) : operation.type === "add" ? [...snapshot.wardrobeItems, operation.item] : snapshot.wardrobeItems.map(item => item.id === operation.item.id ? operation.item : item);
        const next = { items: items.map(item => item.label), wardrobeItems: items, revision: snapshot.revision + 1 };
        publish(next); setDemoPersisted(writeDemoWardrobe(next)); return true;
      }
      const response = await fetch("/api/wardrobe", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: snapshot.revision, operation }) });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409 && data.current) {
          publish(data.current);
          const achieved = operation.type === "delete" ? operation.ids.every(id => !data.current.wardrobeItems.some((item: WardrobeItem) => item.id === id)) : data.current.wardrobeItems.some((item: WardrobeItem) => JSON.stringify(item) === JSON.stringify(operation.item));
          if (achieved) return true;
        }
        throw new Error(data.error || "Could not save your closet. Your input is preserved; please retry.");
      }
      publish(data); return true;
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save your closet. Your input is preserved; please retry."); return false; }
    finally { setBusy(false); }
  }
  const highlighted = snapshot.wardrobeItems.find(item => item.id.toLowerCase() === highlight?.toLowerCase() || item.label.trim().toLowerCase() === highlight?.trim().toLowerCase());
  const heading = embedded ? "h3" : "h1";
  const Heading = heading;
  return <section className="closet-manager space-y-4 rounded-2xl border p-4 sm:p-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
    <ClosetHighlighter highlight={highlight} targetId={highlighted ? closetItemId(highlighted.id) : null} ready={ready} />
    <div className="flex flex-wrap items-center justify-between gap-3"><Heading className="text-xl font-semibold">My closet</Heading><Link href="/outfits" className="control-button text-sm underline">Saved outfits</Link></div>
    <p className="text-sm opacity-70">{snapshot.wardrobeItems.length} items. Mark clothes unavailable when they are in the wash or away.</p>
    {temporary && <p role="status" className="text-sm">{demoPersisted ? "Demo closet: saved in this tab until you sign out. Nothing is stored in the cloud." : "Browser storage is blocked. Demo changes last only on this page."}</p>}
    <form className="flex gap-2" onSubmit={async event => { event.preventDefault(); addId.current ??= crypto.randomUUID(); if (await save({ type: "add", item: newWardrobeItem(addId.current, label.trim()) })) { setLabel(""); addId.current = null; } }}>
      <label className="min-w-0 flex-1"><span className="sr-only">Item description</span><input disabled={busy} maxLength={200} value={label} onChange={event => { setLabel(event.target.value); addId.current = null; }} placeholder="Blue denim jacket" className="form-control" /></label>
      <button disabled={!ready || busy || !label.trim()} className="control-button primary-button">Add</button>
    </form>
    {error && <div role="alert" className="text-sm"><p>{error}</p>{!ready && <button type="button" onClick={() => void load()} className="control-button underline">Retry loading</button>}</div>}
    {selected.length > 0 && <button type="button" disabled={busy} className="control-button text-sm underline" onClick={async () => { if (window.confirm(`Remove ${selected.length} selected items?`) && await save({ type: "delete", ids: selected })) setSelected([]); }}>Delete selected ({selected.length})</button>}
    {draft && <form className="space-y-3 rounded-xl border p-3 sm:p-4" style={{ borderColor: "var(--card-border)" }} onSubmit={async event => { event.preventDefault(); if (await save({ type: "update", item: draft })) setDraft(null); }}>
      <h2 className="font-medium">Edit item</h2>
      <fieldset disabled={busy} className="space-y-3">
        <label className="block text-sm">Description<input required maxLength={200} value={draft.label} onChange={event => setDraft({ ...draft, label: event.target.value })} className="form-control mt-1" /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="min-w-0 text-sm">Category<select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value as WardrobeItem['category'] })} className="form-control mt-1">{WARDROBE_CATEGORIES.map(value => <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>)}</select></label>
          <label className="min-w-0 text-sm">Colour<input maxLength={60} value={draft.colour} onChange={event => setDraft({ ...draft, colour: event.target.value })} className="form-control mt-1" /></label>
          <label className="min-w-0 text-sm">Warmth<select value={draft.warmth} onChange={event => setDraft({ ...draft, warmth: event.target.value as WardrobeItem['warmth'] })} className="form-control mt-1"><option value="unknown">Not set</option><option value="light">Light</option><option value="medium">Medium</option><option value="warm">Warm</option></select></label>
          <label className="min-w-0 text-sm">Waterproofing<select value={draft.waterproofing} onChange={event => setDraft({ ...draft, waterproofing: event.target.value as WardrobeItem['waterproofing'] })} className="form-control mt-1"><option value="unknown">Not set</option><option value="none">Not waterproof</option><option value="resistant">Water resistant</option><option value="waterproof">Waterproof</option></select></label>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.available} onChange={event => setDraft({ ...draft, available: event.target.checked })} />Available to wear</label>
        <div className="flex flex-wrap gap-2"><button disabled={!draft.label.trim()} className="control-button primary-button">Save item</button><button type="button" onClick={() => setDraft(null)} className="control-button underline">Cancel</button></div>
      </fieldset>
    </form>}
    <ul className="space-y-2">{snapshot.wardrobeItems.map(item => <li key={item.id} id={closetItemId(item.id)} tabIndex={-1} className="rounded-xl border p-3" style={{ background: "var(--background)", borderColor: "var(--card-border)" }}>
      <div className="flex items-start gap-2 sm:gap-3"><label className="flex min-h-11 items-center"><input disabled={busy} type="checkbox" aria-label={`Select ${item.label}`} checked={selected.includes(item.id)} onChange={event => setSelected(previous => event.target.checked ? [...previous, item.id] : previous.filter(id => id !== item.id))} /></label>
        <div className="min-w-0 flex-1"><p className="break-words font-medium">{item.label}</p><p className="mt-1 text-xs opacity-70">{[item.category !== "other" ? CATEGORY_LABELS[item.category] : null, item.colour || null, item.warmth !== "unknown" ? `${item.warmth} warmth` : null, item.waterproofing !== "unknown" ? ({ none: "Not waterproof", resistant: "Water resistant", waterproof: "Waterproof" })[item.waterproofing] : null].filter(Boolean).join(" · ") || "Details not set"}</p><p className="mt-1 text-xs font-medium">{item.available ? "Available" : "Unavailable"}</p></div>
        <button type="button" disabled={busy} onClick={() => setDraft({ ...item })} className="control-button shrink-0 text-sm underline" aria-label={`Edit ${item.label}`}>Edit</button>
      </div>
    </li>)}</ul>
    {ready && !snapshot.wardrobeItems.length && <p className="text-sm opacity-70">Start with a few pieces you wear often. You can add details later.</p>}
    {ready && highlight && !highlighted && <p role="status" className="text-sm">This item is no longer in your closet.</p>}
  </section>;
}
