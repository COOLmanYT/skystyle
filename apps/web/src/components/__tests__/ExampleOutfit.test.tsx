import { renderToStaticMarkup } from "react-dom/server";
import ExampleOutfit from "../ExampleOutfit";
import { newWardrobeItem } from "@/lib/wardrobe";
it("shows a free illustration with owned highlights and editable Shop actions, without requesting AI", () => {
  const shirt = newWardrobeItem("11111111-1111-4111-8111-111111111111", "Cotton shirt");
  const html = renderToStaticMarkup(<ExampleOutfit closetItems={[shirt.label]} wardrobeItems={[shirt]} links onShopItem={() => {}} />);
  expect(html).toContain("Example outfit");
  expect(html).toContain("uses no AI allowance");
  expect(html).toContain(`highlight=${shirt.id}`);
  expect(html).toContain("clothing-reference-owned");
  expect(html).toContain("section=shop&amp;item=Light%20jacket");
  expect(fetch).not.toHaveBeenCalled();
});
