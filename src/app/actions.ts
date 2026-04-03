"use server";

import { signOut, auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";

export async function handleSignOut() {
  await signOut({ redirectTo: "/" });
}

export async function submitFeedback(data: {
  category: string;
  rating: number;
  comment: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "You must be logged in to submit feedback." };
    }

    const userId = session.user.id;
    await syncPublicUser(session);

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("is_pro, is_dev")
      .eq("id", userId)
      .single();

    const plan = profile?.is_dev ? "dev" : profile?.is_pro ? "pro" : "free";

    const { error } = await supabaseAdmin.from("feedback").insert({
      user_id: userId,
      plan,
      category: data.category,
      rating: data.rating,
      comment: data.comment || null,
    });

    if (error) {
      return { success: false, error: "Failed to save feedback. Please try again." };
    }

    return { success: true };
  } catch {
    return { success: false, error: "An unexpected error occurred." };
  }
}
