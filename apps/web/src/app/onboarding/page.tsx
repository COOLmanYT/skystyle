import { auth } from "@/auth";
import { redirect } from "next/navigation";
import OnboardingClient from "./OnboardingClient";
import { getOnboardingState } from "@/lib/onboarding";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ replay?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const [params, onboarding] = await Promise.all([
    searchParams,
    getOnboardingState(session.user.id),
  ]);
  if (onboarding.complete && params.replay !== "1") redirect("/dashboard");
  return <OnboardingClient userId={session.user.id} allowBrowserCompletionFallback={!onboarding.persistenceAvailable} />;
}
