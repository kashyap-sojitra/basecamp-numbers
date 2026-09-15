import { redirect } from "next/navigation";
import { AdventureMap } from "@/components/map/AdventureMap";
import { loadLearnerState } from "@/lib/db/learnerRepository";
import { todayLocalDate } from "@/lib/domain/localDate";
import { readLearnerId } from "@/lib/learner/session";
import { ROUTES } from "@/lib/routes";

export const metadata = { title: "Your map · Basecamp Numbers" };

export default async function MapPage() {
  const learnerId = await readLearnerId();
  const state = learnerId === null ? null : await loadLearnerState(learnerId);

  // Nothing saved yet (or no database reachable), so start at onboarding.
  if (state === null) redirect(ROUTES.home);

  return (
    <AdventureMap
      profile={state.profile}
      progress={state.progress}
      days={state.days}
      // Corrected to the child's own timezone on hydration.
      serverToday={todayLocalDate()}
    />
  );
}
