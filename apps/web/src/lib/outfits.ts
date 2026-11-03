import { isUuid, WARDROBE_CATEGORIES, type WardrobeCategory, type WardrobeItem } from "./wardrobe";
import { requireUsableRecommendation, RecommendationOutputError } from "./recommendation-validation";
import { clothingReference } from "./recommendation-links";
export interface OutfitSlot { id: string; category: WardrobeCategory; label: string; itemId: string | null }
export interface OutfitDetails { slots: OutfitSlot[]; gaps: string[]; bring: string[]; changes: string[] }
export interface SavedOutfit { id: string; title: string; revision: number; created_at: string; updated_at: string; payload: OutfitPayload }
export interface OutfitPayload extends OutfitDetails { outfit: string; reasoning: string }
function texts(value: unknown, max: number): string[] {
  if (!Array.isArray(value) || value.length > max || value.some(item => typeof item !== "string" || !item.trim() || item.length > 300)) throw new RecommendationOutputError();
  return (value as string[]).map(item => item.trim());
}
export function parseOutfitDetails(value: unknown, wardrobe: WardrobeItem[], ownedOnly: boolean): OutfitDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RecommendationOutputError();
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.slots) || raw.slots.length > 12) throw new RecommendationOutputError();
  const ids = new Set<string>();
  const slots = raw.slots.map((entry): OutfitSlot => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new RecommendationOutputError();
    const slot = entry as Record<string, unknown>;
    if (typeof slot.id !== "string" || !/^[a-z0-9-]{1,40}$/.test(slot.id) || ids.has(slot.id) ||
        !WARDROBE_CATEGORIES.includes(slot.category as WardrobeCategory) || typeof slot.label !== "string" || !slot.label.trim() || slot.label.length > 200 ||
        (slot.itemId !== null && !isUuid(slot.itemId))) throw new RecommendationOutputError();
    ids.add(slot.id);
    const item = wardrobe.find(item => item.id === slot.itemId && item.available);
    if (slot.itemId !== null && !item || ownedOnly && !item) throw new RecommendationOutputError();
    return { id: slot.id, category: item?.category ?? slot.category as WardrobeCategory, label: item?.label ?? slot.label.trim(), itemId: item?.id ?? null };
  });
  const gaps = texts(raw.gaps, 12), bring = texts(raw.bring, 8), changes = texts(raw.changes, 8);
  if (!slots.length && !gaps.length) throw new RecommendationOutputError();
  return { slots, gaps, bring, changes };
}
export function ownedRecommendation(details: OutfitDetails): OutfitPayload {
  // Render only verified wardrobe labels: provider prose cannot sneak in unowned garments.
  return { ...details, outfit: details.slots.map(slot => clothingReference(slot.label, slot.itemId)).join(", ") || "Your wardrobe needs more items for this outfit.",
    reasoning: details.gaps.length ? `Wardrobe gaps: ${details.gaps.join("; ")}` : "Built from your available wardrobe items." };
}
export function parseOutfitPayload(value: unknown): OutfitPayload {
  const base = requireUsableRecommendation(value as OutfitPayload);
  // Saved snapshots can refer to deleted items; availability is checked when reusing.
  const raw = value as Record<string, unknown>;
  const simulated = Array.isArray(raw.slots) ? raw.slots.filter(s => s?.itemId && isUuid(s.itemId)).map(s => ({ id: s.itemId, label: s.label, category: s.category, available: true } as WardrobeItem)) : [];
  return { outfit: base.outfit.slice(0, 4000), reasoning: base.reasoning.slice(0, 4000), ...parseOutfitDetails(raw, simulated, false) };
}
export function replaceOutfitSlot(payload: OutfitPayload, slotId: string, replacement: WardrobeItem): OutfitPayload {
  if (!replacement.available || !payload.slots.some(slot => slot.id === slotId)) throw new Error("Choose an available item and an existing outfit slot.");
  const current = payload.slots.find(slot => slot.id === slotId)!;
  if (current.category !== "other" && replacement.category !== "other" && current.category !== replacement.category) throw new Error("Choose an item in the same category.");
  const slots = payload.slots.map(slot => slot.id === slotId ? { ...slot, label: replacement.label, itemId: replacement.id, category: replacement.category } : slot);
  return { ...payload, slots, outfit: slots.map(slot => clothingReference(slot.label, slot.itemId)).join(", "), reasoning: `${payload.reasoning}\nUpdated ${clothingReference(current.label, current.itemId)} to ${clothingReference(replacement.label, replacement.id)}.`.slice(0, 4000) };
}
