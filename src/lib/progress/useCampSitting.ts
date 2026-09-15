"use client";

import { useState } from "react";
import type { CampNumber, Mastery } from "@/lib/domain/camp";
import type { AnswerOutcomeKind } from "@/lib/ai/types";
import { milestonesFor, type ClimbContext, type Milestone } from "@/lib/domain/milestones";
import type { ClimberProfile } from "@/lib/domain/onboarding";
import { wantsReadAloud } from "@/lib/domain/onboarding";
import type { LearnerProgress } from "@/lib/domain/progress";
import {
  buildSessionSummary,
  projectProgress,
  type SessionSummaryData,
} from "@/lib/domain/sessionSummary";
import { reactionKey } from "@/lib/motion/presets";
import { useRecordSolves } from "@/lib/progress/saveMastery";
import { useToday } from "@/lib/progress/useToday";

/**
 * Everything a camp screen does that has nothing to do with its mechanic:
 * writing each solve through, the child's own day, the read-aloud decision,
 * the reaction key, and swapping the board for a summary.
 *
 * The checkpoint screen deliberately does not use this — it has no sitting, no
 * summary and no solves to write through.
 */

/**
 * What the sitting has done so far. Both session reducers satisfy this
 * structurally, so a camp screen passes its state straight in.
 */
export interface SittingTally {
  readonly solved: number;
  readonly cleanSolves: number;
  readonly mastery: Mastery;
  /** Wrong attempts at the problem on screen, for the reaction key. */
  readonly wrongAttempts: number;
  /**
   * The slips made in this sitting, oldest first. Passed to the summary so its
   * one AI call can say what the child got better at rather than only how the
   * sitting went — see `summaryRequestSchema`.
   */
  readonly slips: readonly string[];
}

export interface CampSittingInput {
  readonly camp: CampNumber;
  readonly campName: string;
  /** What this camp practises, in plain words, for the summary line. */
  readonly skill: string;
  readonly profile: ClimberProfile;
  /** The learner's whole record as it stood when the screen loaded. */
  readonly progressAtStart: LearnerProgress;
  readonly climb: ClimbContext;
  readonly tally: SittingTally;
}

/**
 * The props `<SessionSummary>` needs, described structurally rather than
 * imported — `lib/` may not depend on `components/`. The spread at the call
 * site is still type-checked against the component's own props.
 */
export interface SessionSummaryHandoff {
  readonly summary: SessionSummaryData;
  readonly campName: string;
  readonly skill: string;
  readonly profile: ClimberProfile;
  readonly milestones: readonly Milestone[];
  readonly slips: readonly string[];
  readonly onKeepGoing: () => void;
}

export interface CampSitting {
  /** Whether the read-aloud button shows for this climber. */
  readonly readAloud: boolean;
  /** Changes on every answer, so a reaction replays for a repeated result. */
  readonly burstKey: number;
  /** Ends the sitting and shows the summary. */
  readonly finish: () => void;
  /** Props for the summary screen, or null while the child is still climbing. */
  readonly summary: SessionSummaryHandoff | null;
}

export function useCampSitting(input: CampSittingInput): CampSitting {
  const { camp, profile, progressAtStart, climb, tally } = input;
  const [finished, setFinished] = useState(false);

  // Every solved problem is written through: it keeps this camp's meter and
  // this learner's solve count — which is what dims the other camps.
  useRecordSolves(camp, tally.solved, tally.mastery, tally.cleanSolves);

  // Today in the child's own timezone, so a streak turns over at their
  // midnight rather than at UTC's.
  const today = useToday(climb.serverToday);

  if (!finished) {
    return {
      readAloud: wantsReadAloud(profile),
      burstKey: reactionKey(tally.solved, tally.wrongAttempts),
      finish: () => { setFinished(true); },
      summary: null,
    };
  }

  const sessionTally = { solved: tally.solved, cleanSolves: tally.cleanSolves };

  return {
    readAloud: wantsReadAloud(profile),
    burstKey: reactionKey(tally.solved, tally.wrongAttempts),
    finish: () => { setFinished(true); },
    summary: {
      summary: buildSessionSummary(progressAtStart, camp, sessionTally, tally.mastery),
      campName: input.campName,
      skill: input.skill,
      profile,
      slips: tally.slips,
      // Bests and streaks are read from the record as it *will* be once this
      // sitting is written through, so the screen agrees with the climb log.
      milestones: milestonesFor({
        band: profile.gradeBand,
        before: progressAtStart,
        after: projectProgress(progressAtStart, camp, sessionTally.solved, tally.mastery),
        days: climb.days,
        today,
        camp,
        campName: input.campName,
        tally: sessionTally,
        checkpointsPassed: climb.checkpointsPassed,
      }),
      onKeepGoing: () => { setFinished(false); },
    },
  };
}

/**
 * How an answer reads to the coach. Both camp screens derived this with the
 * same nested ternary; a wobble before the right answer is a different kind of
 * success and gets different words.
 */
export function answerOutcome(correct: boolean, wrongAttempts: number): AnswerOutcomeKind {
  if (!correct) return "incorrect";
  return wrongAttempts === 0 ? "correct-first-try" : "correct-after-retry";
}
