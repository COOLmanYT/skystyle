import { parseWardrobeItem, type WardrobeSnapshot } from "./wardrobe";
export const WARDROBE_CHANGED = "skystyle_wardrobe_changed";
const KEY = "skystyle_demo_wardrobe";
export function readDemoWardrobe(): WardrobeSnapshot {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (raw && Array.isArray(raw.wardrobeItems) && Number.isSafeInteger(raw.revision)) {
      const wardrobeItems = raw.wardrobeItems.map(parseWardrobeItem);
      return { wardrobeItems, items: wardrobeItems.map((item: { label: string }) => item.label), revision: raw.revision };
    }
  } catch { /* Storage may be blocked; the editor retains its current draft. */ }
  return { wardrobeItems: [], items: [], revision: 0 };
}
export function writeDemoWardrobe(snapshot: WardrobeSnapshot): boolean {
  try { sessionStorage.setItem(KEY, JSON.stringify(snapshot)); window.dispatchEvent(new Event(WARDROBE_CHANGED)); return true; }
  catch { return false; }
}
export function clearDemoWardrobe() {
  try { sessionStorage.removeItem(KEY); window.dispatchEvent(new Event(WARDROBE_CHANGED)); } catch { /* Visit-only fallback. */ }
}
