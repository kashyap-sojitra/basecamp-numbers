import type { CampNumber } from "@/lib/domain/camp";
import { badgesFor, newlyEarned } from "@/lib/domain/badges";
import type { LocalDate } from "@/lib/domain/localDate";
import type { GradeBand } from "@/lib/domain/onboarding";
import type { LearnerProgress } from "@/lib/domain/progress";
import type { SessionTally } from "@/lib/domain/stars";
import {
  campBestDay,
  daysInBand,
  streakFrom,
  todayView,
  type ClimbDay,
} from "@/lib/domain/streak";

/**
 * What this sitting achieved beyond the meters — the part of the summary that
 * gives a reason to come back tomorrow.
 *
 * Every milestone is a *comparison* of the same derived rules run over the
 * record before and after this sitting, so nothing has to be stored to know
 * that something was beaten. Only genuine firsts appear: a milestone the child
 * has already seen is simply absent, never repeated.
 */

/** The climb log a camp screen was opened with, passed down from the server. */
export interface ClimbContext {
  /** Every band's rows; the rules pick what they should read. */
  readonly days: readonly ClimbDay[];
  /** Checkpoint reviews passed in the band being climbed. */
  readonly checkpointsPassed: number;
  /** The server's day; the camp screen corrects it to the child's timezone. */
  readonly serverToday: LocalDate;
}

export interface Milestone {
  readonly id: string;
  readonly glyph: string;
  readonly headline: string;
  readonly detail: string;
}

/** The climb log as it will be once this sitting is written through. */
export function projectDays(
  days: readonly ClimbDay[],
  band: GradeBand,
  camp: CampNumber,
  today: LocalDate,
  tally: SessionTally,
): readonly ClimbDay[] {
  if (tally.solved <= 0) return days;

  const isThisRow = (day: ClimbDay): boolean =>
    day.date === today && day.band === band && day.camp === camp;
  const existing = days.find(isThisRow);

  const updated: ClimbDay = {
    date: today,
    band,
    camp,
    solves: (existing?.solves ?? 0) + tally.solved,
    cleanSolves: (existing?.cleanSolves ?? 0) + tally.cleanSolves,
  };

  return existing === undefined
    ? [...days, updated]
    : days.map((day) => (isThisRow(day) ? updated : day));
}

export interface MilestoneInput {
  /** The band this sitting was climbed in. */
  readonly band: GradeBand;
  readonly before: LearnerProgress;
  readonly after: LearnerProgress;
  readonly days: readonly ClimbDay[];
  readonly today: LocalDate;
  readonly camp: CampNumber;
  readonly campName: string;
  readonly tally: SessionTally;
  readonly checkpointsPassed: number;
}

export function milestonesFor(input: MilestoneInput): readonly Milestone[] {
  const daysAfter = projectDays(input.days, input.band, input.camp, input.today, input.tally);
  const milestones: Milestone[] = [];

  // A personal best is only a best if there was a previous day to beat — at
  // this camp, in this band.
  const bestBefore = campBestDay(daysInBand(input.days, input.band), input.camp);
  const bestAfter = campBestDay(daysInBand(daysAfter, input.band), input.camp);
  if (bestAfter > bestBefore && bestBefore > 0) {
    milestones.push({
      id: "personal-best",
      glyph: "🏅",
      headline: "New personal best",
      detail: `${String(bestAfter)} problems at ${input.campName} in one day — your most yet.`,
    });
  }

  const streakBefore = streakFrom(input.days, input.today);
  const streakAfter = streakFrom(daysAfter, input.today);
  if (streakAfter.current > streakBefore.current) {
    milestones.push(
      streakAfter.current === 1
        ? {
            id: "streak-started",
            glyph: "🔥",
            headline: "Streak started",
            detail: "Climb again tomorrow to make it two days in a row.",
          }
        : {
            id: "streak-extended",
            glyph: "🔥",
            headline: `${String(streakAfter.current)}-day streak`,
            detail:
              streakAfter.current > streakBefore.longest
                ? "That is the longest run you have ever climbed."
                : "Come back tomorrow to keep it going.",
          },
    );
  }

  const goalBefore = todayView(input.days, input.today);
  const goalAfter = todayView(daysAfter, input.today);
  if (goalAfter.goalMet && !goalBefore.goalMet) {
    milestones.push({
      id: "daily-goal",
      glyph: "✅",
      headline: "Today's climb is done",
      detail: `${String(goalAfter.solves)} problems today. Anything more is bonus.`,
    });
  }

  const shared = { band: input.band, today: input.today, checkpointsPassed: input.checkpointsPassed };
  const badgesWon = newlyEarned(
    badgesFor({ ...shared, progress: input.before, days: input.days }),
    badgesFor({ ...shared, progress: input.after, days: daysAfter }),
  );
  for (const badge of badgesWon) {
    milestones.push({
      id: `badge-${badge.id}`,
      glyph: badge.glyph,
      headline: `Badge earned: ${badge.name}`,
      detail: badge.how,
    });
  }

  return milestones;
}
