import { redirect } from "next/navigation";
import { CheckpointScreen } from "@/components/checkpoint/CheckpointScreen";
import { CAMP_DEFINITIONS } from "@/lib/data/camps";
import { loadLearnerState } from "@/lib/db/learnerRepository";
import { masteryView } from "@/lib/domain/progress";
import { readLearnerId } from "@/lib/learner/session";
import { ROUTES } from "@/lib/routes";

export const metadata = { title: "Checkpoint · Basecamp Numbers" };

export default async function CheckpointPage({ params }: PageProps<"/checkpoint/[camp]">) {
  const [{ camp: slug }, learnerId] = await Promise.all([params, readLearnerId()]);
  const state = learnerId === null ? null : await loadLearnerState(learnerId);
  if (state === null) redirect(ROUTES.home);

  const camp = CAMP_DEFINITIONS.find((candidate) => String(candidate.number) === slug);
  if (camp === undefined) redirect(ROUTES.map);

  // Nothing to review if this camp is already bright — don't make the child
  // sit through a checkpoint they do not owe.
  if (!masteryView(state.progress, camp.number).needsReview) redirect(ROUTES.map);

  return <CheckpointScreen camp={camp} profile={state.profile} totalSolves={state.progress.totalSolves} />;
}
