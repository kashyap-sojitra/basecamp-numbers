import type { CampNumber, Mastery } from "@/lib/domain/camp";
import { PREVIOUS_CAMP } from "@/lib/domain/camp";
import { UNLOCK_MASTERY } from "@/lib/domain/mastery";

/**
 * Mastery decay. A camp dims as the child solves problems *elsewhere* without
 * coming back to it — measured in problems, not minutes, so a fortnight away
 * from the app costs nothing and a long run at camp 4 is what pulls camp 1
 * back down.
 *
 * Decay is never destructive: `earned` is what the child actually reached and
 * is kept as-is. The dimmed reading is derived, so passing a checkpoint
 * restores the meter in full rather than making them grind it back.
 */

/**
 * Problems solved elsewhere before a camp starts to dim at all.
 *
 * Three camps' worth of clean climbing: a camp is mastered in
 * `ceil(MASTERY_MAX / GAIN_FIRST_TRY)` = 8 first-try solves, so a child who
 * climbs straight from the trailhead to the summit has solved 24 problems
 * elsewhere by the time camp 4 opens — and must arrive there with camp 1
 * still bright. It was 6, with 4 points a solve, which gated after 14
 * solves elsewhere: less than two camps' worth, so *every* first ascent hit
 * a camp-1 review exactly as the summit opened, and the summit's card showed
 * a number-line question. Decay is for a child who lingers, not one who is
 * climbing.
 */
export const DECAY_GRACE_SOLVES = 24;

/**
 * Mastery points dimmed per problem solved elsewhere, past the grace. Past
 * the threshold after 11 more, so a camp is reviewed after 35 solves away —
 * even an ascent made entirely of after-a-wobble solves (15 a camp) reaches
 * the summit ungated, and a child who then settles in at camp 4 for a dozen
 * problems is sent back for three quick questions.
 */
export const DECAY_PER_SOLVE = 3;

/** However stale a camp gets, its meter never dims below this. */
export const DECAY_FLOOR = 40;

/** Dim past this and advancing needs a checkpoint review of that camp. */
export const CHECKPOINT_THRESHOLD = 70;

/** How many problems a checkpoint asks for. */
export const CHECKPOINT_QUESTIONS = 3;

/** What a camp has earned, and when it was last practised. */
export interface CampRecord {
  /** The highest the meter has reached. Decay never lowers this. */
  readonly earned: Mastery;
  /** The learner's solve count when this camp was last practised. */
  readonly touchedAtSolve: number;
}

export type CampRecords = Readonly<Record<CampNumber, CampRecord>>;

/** Everything decay needs to know about a learner. */
export interface LearnerProgress {
  /** Problems this learner has solved across every camp, ever. */
  readonly totalSolves: number;
  readonly camps: CampRecords;
}

export const NO_RECORD: CampRecord = { earned: 0, touchedAtSolve: 0 };

export const NO_PROGRESS: LearnerProgress = {
  totalSolves: 0,
  camps: { 1: NO_RECORD, 2: NO_RECORD, 3: NO_RECORD, 4: NO_RECORD },
};

/** Problems solved elsewhere since this camp was last practised. */
export function solvesElsewhere(progress: LearnerProgress, camp: CampNumber): number {
  return Math.max(0, progress.totalSolves - progress.camps[camp].touchedAtSolve);
}

/**
 * The meter as it should be shown: the earned value, dimmed by staleness,
 * never below the floor (or below what was earned, if that is lower).
 */
export function dimmedMastery(earned: Mastery, stale: number): Mastery {
  if (earned <= 0) return 0;
  const overdue = Math.max(0, stale - DECAY_GRACE_SOLVES);
  const floor = Math.min(earned, DECAY_FLOOR);
  return Math.max(floor, earned - overdue * DECAY_PER_SOLVE);
}

/** Everything the UI needs to draw one camp's meter, dimming included. */
export interface MasteryView {
  /** What the child reached. */
  readonly earned: Mastery;
  /** What the meter reads now. */
  readonly shown: Mastery;
  /** How much has dimmed away — the ghost segment on the meter. */
  readonly dimmed: number;
  /** Problems solved elsewhere since this camp was practised. */
  readonly stale: number;
  /** True once dimming has actually begun. */
  readonly isDimmed: boolean;
  /** True once this camp is dim enough to gate advancing. */
  readonly needsReview: boolean;
}

/**
 * Whether a meter that reached `earned` and now reads `shown` owes a review.
 * Only a camp that was actually mastered can fall behind enough to gate. The
 * one rule, so a card and the map's gating can never disagree.
 */
export function isGated(earned: Mastery, shown: Mastery): boolean {
  return earned >= UNLOCK_MASTERY && shown < CHECKPOINT_THRESHOLD;
}

export function masteryView(progress: LearnerProgress, camp: CampNumber): MasteryView {
  const { earned } = progress.camps[camp];
  const stale = solvesElsewhere(progress, camp);
  const shown = dimmedMastery(earned, stale);
  return {
    earned,
    shown,
    dimmed: earned - shown,
    stale,
    isDimmed: shown < earned,
    needsReview: isGated(earned, shown),
  };
}

/**
 * The camp that must be reviewed before the child may climb `camp`, or null if
 * the way is clear. The earliest stale camp wins, so the child is always sent
 * back to the foot of the problem rather than the middle of it.
 */
export function campNeedingReview(
  progress: LearnerProgress,
  climbing: CampNumber,
): CampNumber | null {
  let below = PREVIOUS_CAMP[climbing];
  const stale: CampNumber[] = [];

  while (below !== null) {
    if (masteryView(progress, below).needsReview) stale.push(below);
    below = PREVIOUS_CAMP[below];
  }

  // `stale` is collected top-down, so the last entry is the earliest camp.
  return stale.at(-1) ?? null;
}
