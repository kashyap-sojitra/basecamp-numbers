import { redirect } from "next/navigation";
import { ClimbLog } from "@/components/log/ClimbLog";
import { loadLearnerState } from "@/lib/db/learnerRepository";
import { todayLocalDate } from "@/lib/domain/localDate";
import { readLearnerId } from "@/lib/learner/session";
import { ROUTES } from "@/lib/routes";

export const metadata = { title: "My progress · Basecamp Numbers" };

export default async function LogPage() {
  const learnerId = await readLearnerId();
  const state = learnerId === null ? null : await loadLearnerState(learnerId);

  // Nothing saved yet (or no database reachable), so start at onboarding.
  if (state === null) redirect(ROUTES.home);

  return (
    <ClimbLog
      profile={state.profile}
      progress={state.progress}
      climbs={state.climbs}
      days={state.days}
      checkpointsPassed={state.checkpointsPassed}
      // The server's day, corrected to the child's timezone on hydration.
      serverToday={todayLocalDate()}
    />
  );
}
