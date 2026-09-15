import type { CampNumber } from "@/lib/domain/camp";
import type { GradeBand } from "@/lib/domain/onboarding";
import { STAR_EFFORT } from "@/lib/domain/stars";
import { daysBetween, dayOrdinal, type LocalDate } from "@/lib/domain/localDate";

/**
 * Climb days and the streak drawn from them — the reason to come back
 * tomorrow rather than the reason never to stop today.
 *
 * Two rules keep this on the encouraging side of CLAUDE.md. A streak survives
 * one missed day, so a single busy evening does not wipe out a fortnight. And
 * a lapsed streak is described as *resting*, never lost: the child is told
 * what it was and invited to start again, never scolded.
 */

/** Problems in a day that make it a proper climb. Matches the star rule. */
export const DAILY_GOAL = STAR_EFFORT;

/** A streak survives this many missed days before it goes to rest. */
export const STREAK_GRACE_DAYS = 1;

/**
 * One camp's work on one local day, in one grade band. The row shape,
 * straight from the log.
 *
 * The band is on the row because two things are read from this log and they
 * have different scopes. *Turning up* — the streak, the calendar, the daily
 * goal — is the child's, whatever they were climbing, so those rules read
 * every row. *The climb* — problems solved, right first time, a camp's best
 * day, the badges about climbing — is the band's, so those rules read only
 * the rows of the band being climbed (`daysInBand`). Without the band on the
 * row, a fresh grade inherited every badge the last one had earned.
 */
export interface ClimbDay {
  readonly date: LocalDate;
  readonly band: GradeBand;
  readonly camp: CampNumber;
  readonly solves: number;
  /** Of those, how many were right first time. */
  readonly cleanSolves: number;
}

/** The rows of one climb: what was solved while climbing this band. */
export function daysInBand(days: readonly ClimbDay[], band: GradeBand): readonly ClimbDay[] {
  return days.filter((day) => day.band === band);
}

export type StreakStatus = "unstarted" | "climbing" | "resting";

export interface StreakView {
  readonly status: StreakStatus;
  /** Days in the live run. Zero while resting or unstarted. */
  readonly current: number;
  /** The best run ever, live or not. Never goes down. */
  readonly longest: number;
  /** The run that lapsed, kept so the copy can name it. */
  readonly resting: number;
  readonly climbedToday: boolean;
  readonly lastClimb: LocalDate | null;
}

const NOTHING_YET: StreakView = {
  status: "unstarted",
  current: 0,
  longest: 0,
  resting: 0,
  climbedToday: false,
  lastClimb: null,
};

/**
 * THE STREAK RULE.
 *
 *   no days logged                  -> unstarted
 *   last climb today or yesterday   -> climbing, `current` days long
 *   last climb older than that      -> resting, and `resting` says how long
 *                                      the run was before it lapsed
 *
 * A day counts as climbed if any problem was solved in it, in any camp.
 */
export function streakFrom(days: readonly ClimbDay[], today: LocalDate): StreakView {
  const climbed = [...new Set(days.filter((day) => day.solves > 0).map((day) => day.date))];
  if (climbed.length === 0) return NOTHING_YET;

  const ordinals = climbed.map(dayOrdinal).sort((a, b) => a - b);

  let longest = 1;
  let run = 1;
  for (let index = 1; index < ordinals.length; index += 1) {
    const day = ordinals[index];
    const before = ordinals[index - 1];
    // Guarded rather than asserted; the loop bounds already make these real.
    if (day === undefined || before === undefined) continue;
    run = day - before === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const lastClimb = climbed.reduce((latest, day) => (dayOrdinal(day) > dayOrdinal(latest) ? day : latest));
  const sinceLast = daysBetween(lastClimb, today);
  const alive = sinceLast <= STREAK_GRACE_DAYS;

  return {
    status: alive ? "climbing" : "resting",
    current: alive ? run : 0,
    longest,
    resting: alive ? 0 : run,
    climbedToday: sinceLast === 0,
    lastClimb,
  };
}

/** What today looks like on its own: solves so far, and whether that is a climb. */
export interface TodayView {
  readonly solves: number;
  readonly cleanSolves: number;
  readonly goal: number;
  /** Solves still wanted for today to count as a full climb. */
  readonly remaining: number;
  readonly goalMet: boolean;
}

export function todayView(days: readonly ClimbDay[], today: LocalDate): TodayView {
  const mine = days.filter((day) => day.date === today);
  const solves = mine.reduce((total, day) => total + day.solves, 0);
  const cleanSolves = mine.reduce((total, day) => total + day.cleanSolves, 0);
  return {
    solves,
    cleanSolves,
    goal: DAILY_GOAL,
    remaining: Math.max(0, DAILY_GOAL - solves),
    goalMet: solves >= DAILY_GOAL,
  };
}

/** "1 day" but "4 days", so the copy never reads like a bug. */
function dayCount(days: number): string {
  return `${String(days)} day${days === 1 ? "" : "s"}`;
}

/** The streak in the child's own terms. Warm when it lapses, never punitive. */
export function streakMessage(view: StreakView, today: TodayView): string {
  switch (view.status) {
    case "unstarted":
      return "Climb today to start your streak.";
    case "resting":
      return view.resting >= 2
        ? `Your ${String(view.resting)}-day streak is resting. Climb today to start a new one.`
        : "Climb today to start a new streak.";
    case "climbing":
      if (!view.climbedToday) {
        return `${String(view.current)}-day streak — climb today to keep it going.`;
      }
      return today.goalMet
        ? `${dayCount(view.current)} in a row. Today's climb is done.`
        : `${String(view.current)}-day streak. ${String(today.remaining)} more today for a full climb.`;
  }
}

/** Days climbed, most solves in a day, and the running totals. */
export interface ClimbTotals {
  readonly daysClimbed: number;
  readonly solves: number;
  readonly cleanSolves: number;
  /** The most problems solved in any single day. */
  readonly bestDaySolves: number;
}

export function climbTotals(days: readonly ClimbDay[]): ClimbTotals {
  const perDay = new Map<LocalDate, number>();
  let solves = 0;
  let cleanSolves = 0;

  for (const day of days) {
    solves += day.solves;
    cleanSolves += day.cleanSolves;
    perDay.set(day.date, (perDay.get(day.date) ?? 0) + day.solves);
  }

  return {
    daysClimbed: [...perDay.values()].filter((count) => count > 0).length,
    solves,
    cleanSolves,
    bestDaySolves: Math.max(0, ...perDay.values()),
  };
}

/**
 * The most problems solved in one day in one camp — a per-camp personal best.
 * Pass the band's rows (`daysInBand`): camp 1 of K-1 and camp 1 of 4-5 are
 * different climbs with different bests.
 */
export function campBestDay(days: readonly ClimbDay[], camp: CampNumber): number {
  return Math.max(0, ...days.filter((day) => day.camp === camp).map((day) => day.solves));
}
