import { redirect } from "next/navigation";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { loadLearnerState } from "@/lib/db/learnerRepository";
import { readLearnerId } from "@/lib/learner/session";
import { ROUTES } from "@/lib/routes";

/**
 * A returning learner goes straight back to their mountain — their picks are
 * already saved. `?change` reopens onboarding so they can change them.
 */
export const metadata = { title: "Get ready to climb · Basecamp Numbers" };

export default async function Home({ searchParams }: PageProps<"/">) {
  const [{ change }, learnerId] = await Promise.all([searchParams, readLearnerId()]);
  const state = learnerId === null ? null : await loadLearnerState(learnerId);

  if (state !== null && change === undefined) redirect(ROUTES.map);

  return <OnboardingScreen existing={state?.profile ?? null} />;
}
