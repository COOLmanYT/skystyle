import { supabaseAdmin } from "./supabase";
import { DEMO_USER_ID } from "./demo";

export interface OnboardingState {
  complete: boolean;
  experienceMode: "guided" | "advanced" | null;
  persistenceAvailable: boolean;
}

/** Read durable onboarding state while allowing a browser fallback if the query fails. */
export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  if (userId === DEMO_USER_ID) return { complete: false, experienceMode: null, persistenceAvailable: false };
  try {
    const { data, error } = await supabaseAdmin
      .from("settings")
      .select("onboarding_completed_at,experience_mode")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return { complete: false, experienceMode: null, persistenceAvailable: false };
    }

    return {
      complete: Boolean(data?.onboarding_completed_at),
      experienceMode: data?.experience_mode === "advanced" ? "advanced" : data?.experience_mode === "guided" ? "guided" : null,
      persistenceAvailable: true,
    };
  } catch {
    return { complete: false, experienceMode: null, persistenceAvailable: false };
  }
}
