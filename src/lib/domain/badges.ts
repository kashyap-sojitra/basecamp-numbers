import { CAMP_NUMBERS, type CampNumber } from "@/lib/domain/camp";
import { isCampComplete } from "@/lib/domain/mastery";
import type { LearnerProgress } from "@/lib/domain/progress";
import { climbTotals, daysInBand, streakFrom, type ClimbDay } from "@/lib/domain/streak";
import type { LocalDate } from "@/lib/domain/localDate";
import type { GradeBand } from "@/lib/domain/onboarding";

/**
 * Badges for the Climb Log.
 *
 * Every badge is *derived* from the mastery meters and the climb log rather
 * than stored, so there is no second source of truth to drift: a badge the
 * child has earned is recomputed identically on every visit, and one cannot
 * be lost to a failed write. Unearned badges are shown as silhouettes — the
 * point is to say what is within reach, not to withhold.
 *
 * Badges belong to **the climb**, so six of the seven read only the band
 * being climbed: its meters, its solves, its checkpoints. A child who starts
 * a new grade starts its badges from nothing — it used to hand them First
 * Steps and Century on arrival, because the log was read whole. The one
 * exception is Seven Days, which is about turning up and reads every row:
 * a streak is the child's, whatever they were climbing.
 */

export type BadgeId =
  | "first-climb"
  | "camp-mastered"
  | "summit"
  | "week-of-climbing"
  | "hundred-problems"
  | "sharp-shooter"
  | "back-on-track";

export interface Badge {
  readonly id: BadgeId;
  readonly name: string;
  readonly glyph: string;
  /** What earns it, in the child's own terms. Shown earned or not. */
  readonly how: string;
  readonly earned: boolean;
  /** Progress toward it, 0-1, for the ones worth counting down. */
  readonly progress: number;
}

/** Solves before the sharp-shooter badge looks at accuracy at all. */
const SHARP_MIN_SOLVES = 20;
const SHARP_ACCURACY = 0.8;
const WEEK = 7;
const HUNDRED = 100;

/** Everything the badge rules read. */
export interface BadgeInput {
  /** The band being climbed: the meters, the solves and the checkpoints are its. */
  readonly band: GradeBand;
  /** This band's meters. */
  readonly progress: LearnerProgress;
  /** The whole log, every band; the rules pick the rows they should read. */
  readonly days: readonly ClimbDay[];
  readonly today: LocalDate;
  /** Checkpoint reviews passed in this band. */
  readonly checkpointsPassed: number;
}

function ratio(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(1, Math.max(0, part / whole));
}

/**
 * THE BADGE RULES — all seven, in one place, each a pure read of state the
 * app already keeps.
 */
export function badgesFor(input: BadgeInput): readonly Badge[] {
  // The climb's own rows for the climbing badges; every row for the streak.
  const totals = climbTotals(daysInBand(input.days, input.band));
  const streak = streakFrom(input.days, input.today);
  const mastered = CAMP_NUMBERS.filter((camp: CampNumber) =>
    isCampComplete(input.progress.camps[camp].earned),
  ).length;
  const accuracy = ratio(totals.cleanSolves, totals.solves);

  return [
    {
      id: "first-climb",
      name: "First Steps",
      glyph: "🥾",
      how: "Solve your first problem",
      earned: totals.solves >= 1,
      progress: ratio(totals.solves, 1),
    },
    {
      id: "camp-mastered",
      name: "Camp Master",
      glyph: "⛺",
      how: "Fill a camp's Mastery Meter",
      earned: mastered >= 1,
      progress: ratio(mastered, 1),
    },
    {
      id: "summit",
      name: "Summiteer",
      glyph: "🏔️",
      how: "Master all four camps",
      earned: mastered >= CAMP_NUMBERS.length,
      progress: ratio(mastered, CAMP_NUMBERS.length),
    },
    {
      id: "week-of-climbing",
      name: "Seven Days",
      glyph: "📅",
      how: "Climb seven days in a row",
      earned: streak.longest >= WEEK,
      progress: ratio(streak.longest, WEEK),
    },
    {
      id: "hundred-problems",
      name: "Century",
      glyph: "💯",
      how: "Solve 100 problems",
      earned: totals.solves >= HUNDRED,
      progress: ratio(totals.solves, HUNDRED),
    },
    {
      id: "sharp-shooter",
      name: "Sharp Shooter",
      glyph: "🎯",
      how: "Get 8 in 10 right first time, over 20 problems",
      earned: totals.solves >= SHARP_MIN_SOLVES && accuracy >= SHARP_ACCURACY,
      progress:
        totals.solves < SHARP_MIN_SOLVES
          ? ratio(totals.solves, SHARP_MIN_SOLVES)
          : ratio(accuracy, SHARP_ACCURACY),
    },
    {
      id: "back-on-track",
      name: "Back On Track",
      glyph: "🔔",
      how: "Pass a checkpoint review",
      earned: input.checkpointsPassed >= 1,
      progress: ratio(input.checkpointsPassed, 1),
    },
  ];
}

/** The badges just crossed into, for a "you earned this" moment. */
export function newlyEarned(
  before: readonly Badge[],
  after: readonly Badge[],
): readonly Badge[] {
  const had = new Set(before.filter((badge) => badge.earned).map((badge) => badge.id));
  return after.filter((badge) => badge.earned && !had.has(badge.id));
}
