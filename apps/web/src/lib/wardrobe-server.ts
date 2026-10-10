import { supabaseAdmin } from "./supabase";
import { wardrobeSnapshot, type WardrobeSnapshot } from "./wardrobe";
export async function readWardrobe(userId: string): Promise<WardrobeSnapshot> {
  const { data, error } = await supabaseAdmin.from("closet").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Unable to load wardrobe. Please retry.");
  if (!data) {
    const result = await supabaseAdmin.rpc("v63_mutate_wardrobe", { p_user_id: userId, p_expected_revision: 0, p_operation: { type: "initialize" } });
    if (result.error) throw new Error("Wardrobe storage is not ready. Please retry when the update is available.");
    return result.data as WardrobeSnapshot;
  }
  return wardrobeSnapshot(data);
}
