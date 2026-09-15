import type { Camp, CampDefinition, CampNumber, CampProgress } from "@/lib/domain/camp";
import { PREVIOUS_CAMP } from "@/lib/domain/camp";
import { UNLOCK_MASTERY } from "@/lib/domain/mastery";
import {
  campNeedingReview,
  masteryView,
  type LearnerProgress,
} from "@/lib/domain/decay";

export {
  NO_PROGRESS,
  NO_RECORD,
  campNeedingReview,
  isGated,
  masteryView,
  type CampRecord,
  type CampRecords,
  type LearnerProgress,
  type MasteryView,
} from "@/lib/domain/decay";
export { UNLOCK_MASTERY } from "@/lib/domain/mastery";

/**
 * Where a camp stands, given the learner's whole record. Derived rather than
 * stored, so the map and the camp screens can never disagree.
 */
export function deriveCampProgress(
  camp: CampNumber,
  progress: LearnerProgress,
): CampProgress {
  const view = masteryView(progress, camp);
  const below = PREVIOUS_CAMP[camp];

  // The trailhead is always open — it is where a dimmed climber goes to
  // practise, so it can never be gated behind itself.
  if (below === null) return { status: "open", mastery: view.shown, earned: view.earned };

  if (progress.camps[below].earned < UNLOCK_MASTERY) {
    return { status: "locked", unlocksAfter: below };
  }

  const review = campNeedingReview(progress, camp);
  if (review !== null) {
    return {
      status: "checkpoint",
      mastery: view.shown,
      earned: view.earned,
      reviewOf: review,
    };
  }

  return { status: "open", mastery: view.shown, earned: view.earned };
}

/** The four camps with this learner's progress attached. */
export function campsWithProgress(
  definitions: readonly [CampDefinition, CampDefinition, CampDefinition, CampDefinition],
  progress: LearnerProgress,
): readonly [Camp, Camp, Camp, Camp] {
  const [one, two, three, four] = definitions;
  const attach = (definition: CampDefinition): Camp => ({
    ...definition,
    progress: deriveCampProgress(definition.number, progress),
  });
  return [attach(one), attach(two), attach(three), attach(four)];
}
