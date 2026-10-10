"use client";
import { useCallback, useEffect, useState } from "react";
import { clothingItemName } from "@/lib/recommendation-links";
import { parseWardrobeItem, type WardrobeSnapshot } from "@/lib/wardrobe";
import { readDemoWardrobe, WARDROBE_CHANGED } from "@/lib/demo-wardrobe";
export default function useClothingInventory(temporary = false) {
  const [snapshot, setSnapshot] = useState<WardrobeSnapshot>({ items: [], wardrobeItems: [], revision: 0 });
  const [structured, setStructured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    let active = true, sequence = 0;
    let controller: AbortController | undefined;
    async function load() {
      const request = ++sequence;
      controller?.abort(); controller = new AbortController();
      if (temporary) { setSnapshot(readDemoWardrobe()); setStructured(true); setLoading(false); setError(""); return; }
      try {
        const response = await fetch("/api/closet", { signal: controller.signal });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (data.persistence === "unavailable-in-demo") {
          if (active && request === sequence) { setSnapshot(readDemoWardrobe()); setStructured(true); setError(""); }
          return;
        }
        const wardrobeItems = Array.isArray(data.wardrobeItems) ? data.wardrobeItems.map(parseWardrobeItem) : [];
        if (active && request === sequence) {
          setSnapshot({ items: Array.isArray(data.items) ? data.items.filter((item: unknown) => clothingItemName(item)) : [], wardrobeItems, revision: data.revision ?? 0 });
          setStructured(Array.isArray(data.wardrobeItems)); setError("");
        }
      } catch (failure) {
        if (active && request === sequence && !(failure instanceof Error && failure.name === "AbortError")) setError("Your closet could not be loaded. Retry before using clothing links.");
      } finally { if (active && request === sequence) setLoading(false); }
    }
    function visible() { if (document.visibilityState === "visible") void load(); }
    void load();
    window.addEventListener("focus", visible);
    window.addEventListener(WARDROBE_CHANGED, load);
    return () => { active = false; controller?.abort(); window.removeEventListener("focus", visible); window.removeEventListener(WARDROBE_CHANGED, load); };
  }, [temporary, attempt]);
  return { ...snapshot, snapshot, structured, loading, error, retry, update: setSnapshot };
}
