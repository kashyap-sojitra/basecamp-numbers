import type { CampNumber, Mastery } from "@/lib/domain/camp";
import { CAMP_NUMBERS } from "@/lib/domain/camp";
import {
  masteryView,
  type LearnerProgress,
  type MasteryView,
} from "@/lib/domain/progress";
import { MASTERY_MAX } from "@/lib/domain/mastery";
import { starsForSession, type SessionTally, type Stars } from "@/lib/domain/stars";
import type { SummaryRequest } from "@/lib/ai/types";

/**
 * What one sitting did to the mountain. Everything here is derived from the
 * progress snapshot taken when the screen loaded plus the session's own tally,
 * so the summary can show before and after without storing anything.
 */

/** One camp's meter, before this sitting and after it. */
export interface CampDelta {
  readonly camp: CampNumber;
  readonly before: MasteryView;
  readonly after: MasteryView;
  /** True for the camp the child actually practised. */
  readonly practised: boolean;
}

export interface SessionSummaryData {
  readonly stars: Stars;
  readonly tally: SessionTally;
  readonly camps: readonly CampDelta[];
  /** True when the practised camp's meter rose. */
  readonly masteryRose: boolean;
  readonly campCompleted: boolean;
  readonly shape: SummaryRequest["shape"];
}

/**
 * The learner's record as it will be once this sitting is saved. Solving here
 * raises the solve count, which is exactly what dims the *other* camps — so
 * the after-meters show earlier camps slipping, not just this one rising.
 */
export function projectProgress(
  before: LearnerProgress,
  camp: CampNumber,
  solved: number,
  mastery: Mastery,
): LearnerProgress {
  const totalSolves = before.totalSolves + solved;
  return {
    totalSolves,
    camps: {
      ...before.camps,
      [camp]: {
        earned: Math.max(before.camps[camp].earned, mastery),
        // Only actually practised if something was solved.
        touchedAtSolve: solved > 0 ? totalSolves : before.camps[camp].touchedAtSolve,
      },
    },
  };
}

function shapeOf(stars: Stars): SummaryRequest["shape"] {
  switch (stars) {
    case 0:
      return "nothing";
    case 1:
      return "wobbly";
    case 2:
      return "steady";
    case 3:
      return "strong";
  }
}

export function buildSessionSummary(
  before: LearnerProgress,
  camp: CampNumber,
  tally: SessionTally,
  mastery: Mastery,
): SessionSummaryData {
  const after = projectProgress(before, camp, tally.solved, mastery);
  const stars = starsForSession(tally);

  return {
    stars,
    tally,
    camps: CAMP_NUMBERS.map((number) => ({
      camp: number,
      before: masteryView(before, number),
      after: masteryView(after, number),
      practised: number === camp,
    })),
    masteryRose: masteryView(after, camp).earned > masteryView(before, camp).earned,
    campCompleted:
      masteryView(after, camp).earned >= MASTERY_MAX &&
      masteryView(before, camp).earned < MASTERY_MAX,
    shape: shapeOf(stars),
  };
}
