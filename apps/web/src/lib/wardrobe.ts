export const WARDROBE_CATEGORIES = ["top", "bottom", "one-piece", "outerwear", "footwear", "accessory", "other"] as const;
export type WardrobeCategory = typeof WARDROBE_CATEGORIES[number];
export interface WardrobeItem {
  id: string; label: string; category: WardrobeCategory; colour: string;
  warmth: "unknown" | "light" | "medium" | "warm";
  waterproofing: "unknown" | "none" | "resistant" | "waterproof";
  available: boolean;
}
export interface WardrobeSnapshot { wardrobeItems: WardrobeItem[]; revision: number; items: string[] }
export function isUuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
export function parseWardrobeItem(value: unknown): WardrobeItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid wardrobe item.");
  const item = value as Record<string, unknown>;
  if (!isUuid(item.id) || typeof item.label !== "string" || !item.label.trim() || item.label.length > 200 ||
      !WARDROBE_CATEGORIES.includes(item.category as WardrobeCategory) || typeof item.colour !== "string" || item.colour.length > 60 ||
      !["unknown", "light", "medium", "warm"].includes(String(item.warmth)) ||
      !["unknown", "none", "resistant", "waterproof"].includes(String(item.waterproofing)) || typeof item.available !== "boolean") throw new Error("Invalid wardrobe item fields.");
  return { id: item.id, label: item.label.trim(), category: item.category as WardrobeCategory, colour: item.colour.trim(),
    warmth: item.warmth as WardrobeItem["warmth"], waterproofing: item.waterproofing as WardrobeItem["waterproofing"], available: item.available };
}
export function newWardrobeItem(id: string, label: string): WardrobeItem {
  return { id, label, category: "other", colour: "", warmth: "unknown", waterproofing: "unknown", available: true };
}
export function wardrobeSnapshot(row: Record<string, unknown> | null): WardrobeSnapshot {
  if (!row || !Array.isArray(row.wardrobe_items) || !Number.isSafeInteger(row.revision)) throw new Error("Wardrobe storage is not ready. Please try again after the update is available.");
  return { wardrobeItems: row.wardrobe_items.map(parseWardrobeItem), revision: row.revision as number,
    items: (row.wardrobe_items as WardrobeItem[]).map(item => item.label) };
}
