"use server";

import { signOut, auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";

export async function handleSignOut() {
  await signOut({ redirectTo: "/" });
}

const FEEDBACK_COOLDOWN_SECONDS = 600; // 10 minutes

export async function submitFeedback(data: {
  category: string;
  rating: number;
  comment: string;
}): Promise<{ success: boolean; error?: string; rateLimited?: boolean; retryAfterSeconds?: number }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "You must be logged in to submit feedback." };
    }

    const userId = session.user.id;
    await syncPublicUser(session);

    // Rate-limit check: one submission per 10 minutes per user
    const windowStart = new Date(Date.now() - FEEDBACK_COOLDOWN_SECONDS * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("feedback")
      .select("created_at")
      .eq("user_id", userId)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false })
      .limit(1);

    if (recent && recent.length > 0) {
      const lastSent = new Date(recent[0].created_at).getTime();
      const retryAfterSeconds = Math.ceil(
        (lastSent + FEEDBACK_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000
      );
      return {
        success: false,
        rateLimited: true,
        retryAfterSeconds: Math.max(retryAfterSeconds, 1),
        error:
          "Slow down! I've already got your last message. Please wait a few minutes before sending more feedback.",
      };
    }

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
