import MarkdownRenderer from "./MarkdownRenderer";
import { clothingReference } from "@/lib/recommendation-links";
import type { WardrobeItem } from "@/lib/wardrobe";
export default function ExampleOutfit({ closetItems, wardrobeItems, links, onShopItem }: {
  closetItems: string[]; wardrobeItems: WardrobeItem[]; links: boolean; onShopItem: (item: string) => void;
}) {
  const clothes = ["Cotton shirt", "Straight-leg trousers", "Comfortable sneakers", "Light jacket"];
  return <section className="space-y-3 rounded-2xl border p-5" style={{ background: "var(--card)", borderColor: "var(--card-border)" }} aria-label="Example outfit">
    <h2 className="text-sm font-semibold">Example outfit</h2>
    <p className="text-xs opacity-70">An illustration to get you started. Choose a location for advice based on your weather and preferences.</p>
    <MarkdownRenderer content={clothes.map(name => clothingReference(name)).join(" · ")} className="text-sm" closetItems={closetItems} wardrobeItems={wardrobeItems} recommendationLinks={links} onShopItem={onShopItem} />
    <p className="text-xs opacity-70">Start with a comfortable base and a removable layer. Highlighted clothes are in your closet; other clothing links prepare Shop. This example uses no AI allowance.</p>
  </section>;
}
