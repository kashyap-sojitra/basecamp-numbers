import { redirect } from "next/navigation";
import { GroupingCamp } from "@/components/grouping/GroupingCamp";
import { NumberLineJumpCamp } from "@/components/numberline/NumberLineJumpCamp";
import { PickTheJumpCamp } from "@/components/quiz/PickTheJumpCamp";
import { TradeUpCamp } from "@/components/trade/TradeUpCamp";
import { CAMP_DEFINITIONS } from "@/lib/data/camps";
import { loadLearnerState } from "@/lib/db/learnerRepository";
import { todayLocalDate } from "@/lib/domain/localDate";
import { readLearnerId } from "@/lib/learner/session";
import { ROUTES } from "@/lib/routes";

export const metadata = { title: "Camp · Basecamp Numbers" };

export default async function CampPage({ params }: PageProps<"/camp/[camp]">) {
  const [{ camp: slug }, learnerId] = await Promise.all([params, readLearnerId()]);
  const state = learnerId === null ? null : await loadLearnerState(learnerId);
  if (state === null) redirect(ROUTES.home);

  const camp = CAMP_DEFINITIONS.find((candidate) => String(candidate.number) === slug);
  if (camp === undefined) redirect(ROUTES.map);

  // Lock state is derived from mastery, which the map gates on. A typed-in URL
  // still opens a camp, which is fine for a single-child app with no accounts.
  const startingMastery = state.progress.camps[camp.number].earned;

  const climb = {
    days: state.days,
    checkpointsPassed: state.checkpointsPassed,
    // Corrected to the child's own timezone on hydration.
    serverToday: todayLocalDate(),
  };

  switch (camp.mechanic.kind) {
    case "number-line-jump":
      return (
        <NumberLineJumpCamp
          camp={camp}
          skill={camp.mechanic.skill}
          profile={state.profile}
          startingMastery={startingMastery}
          progressAtStart={state.progress}
          climb={climb}
        />
      );
    case "pick-the-jump":
      return (
        <PickTheJumpCamp
          camp={camp}
          skill={camp.mechanic.skill}
          profile={state.profile}
          startingMastery={startingMastery}
          progressAtStart={state.progress}
          climb={climb}
        />
      );
    case "trade-up":
      return (
        <TradeUpCamp
          camp={camp}
          profile={state.profile}
          startingMastery={startingMastery}
          progressAtStart={state.progress}
          climb={climb}
        />
      );
    case "array-grouping":
      return (
        <GroupingCamp
          camp={camp}
          focus={camp.mechanic.focus}
          profile={state.profile}
          startingMastery={startingMastery}
          progressAtStart={state.progress}
          climb={climb}
        />
      );
  }
}
