import "server-only";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { CampNumber } from "@/lib/domain/camp";
import { campNumberSchema } from "@/lib/domain/camp";
import { MASTERY_MAX, masteryGain, masterySchema } from "@/lib/domain/mastery";
import {
  climberProfileSchema,
  gradeBandSchema,
  type ClimberProfile,
  type GradeBand,
} from "@/lib/domain/onboarding";
import { NO_PROGRESS, NO_RECORD, type CampRecord, type LearnerProgress } from "@/lib/domain/progress";
import { localDateSchema, type LocalDate } from "@/lib/domain/localDate";
import type { ClimbDay } from "@/lib/domain/streak";
import type { LearnerId } from "@/lib/learner/learnerId";
import { getDb, isDatabaseConfigured } from "./client";
import { bandProgress, campMastery, climbDays, learners } from "./schema";

/** Everything persisted about one learner. */
/** One band's climb: its meters and solve counter, and its reviews passed. */
export interface BandClimb {
  readonly progress: LearnerProgress;
  /** Checkpoint reviews passed in this band, for the badge that cannot be derived. */
  readonly checkpointsPassed: number;
}

/** A climb that has not started. */
export const NO_CLIMB: BandClimb = { progress: NO_PROGRESS, checkpointsPassed: 0 };

export interface LearnerState {
  readonly profile: ClimberProfile;
  /** The climb of the band being climbed now — `climbs[profile.gradeBand]`. */
  readonly progress: LearnerProgress;
  /** Checkpoint reviews passed in that band. */
  readonly checkpointsPassed: number;
  /** Every band's climb, so the progress screen can lay them side by side. */
  readonly climbs: Readonly<Record<GradeBand, BandClimb>>;
  /** The climb log: one row per band per camp per local day, every band. */
  readonly days: readonly ClimbDay[];
}

/**
 * One solve, as the log sees it. Note what is *not* here: the resulting meter.
 * The client reports only what happened and the server works out what it is
 * worth, because the meter is the one stored thing that cannot be re-derived.
 */
export interface SolveRecord {
  readonly camp: CampNumber;
  /** The child's own calendar day, decided on the client. */
  readonly localDate: LocalDate;
  /** True if this one was right first time. Decides the gain, nothing else. */
  readonly clean: boolean;
}

/**
 * Rows are typed by Drizzle at compile time only — at runtime they are just
 * JSON off the wire, so they are parsed like any other untrusted boundary.
 */
const masteryRowSchema = z.object({
  gradeBand: gradeBandSchema,
  campNumber: campNumberSchema,
  mastery: masterySchema,
  touchedAtSolve: z.number().int().min(0),
});

const learnerRowSchema = climberProfileSchema;

const solveCountSchema = z.object({ totalSolves: z.number().int().min(0) });

const bandRowSchema = z.object({
  gradeBand: gradeBandSchema,
  totalSolves: z.number().int().min(0),
  checkpointsPassed: z.number().int().min(0),
});

const climbDayRowSchema = z.object({
  gradeBand: gradeBandSchema,
  localDate: localDateSchema,
  campNumber: campNumberSchema,
  solves: z.number().int().min(0),
  cleanSolves: z.number().int().min(0),
});

/**
 * The band this learner is climbing, straight from the saved profile.
 *
 * Every write is scoped by it, and it is never taken from the request: the
 * band decides which climb a solve counts towards, so it is the server's to
 * know.
 */
async function bandOf(
  db: ReturnType<typeof getDb>,
  learnerId: LearnerId,
): Promise<ClimberProfile["gradeBand"] | null> {
  const rows = await db
    .select({ gradeBand: learners.gradeBand })
    .from(learners)
    .where(eq(learners.id, learnerId))
    .limit(1);
  const parsed = climberProfileSchema.pick({ gradeBand: true }).safeParse(rows[0]);
  return parsed.success ? parsed.data.gradeBand : null;
}

/**
 * The driver wraps a failure as "Failed query: <sql>" and puts Postgres's own
 * words — "relation band_progress does not exist" — in `cause`. The log needs
 * both, or a missing migration reads like a broken query.
 */
function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? ` — ${error.cause.message}` : "";
  return `${error.message}${cause}`;
}

/**
 * The learner's saved state, or null if they are new — or if the database is
 * unreachable. A child should always get a playable app: losing the connection
 * costs them their saved progress, not the game.
 */
export async function loadLearnerState(learnerId: LearnerId): Promise<LearnerState | null> {
  if (!isDatabaseConfigured()) return null;

  try {
    const db = getDb();

    const learnerRows = await db
      .select({
        gradeBand: learners.gradeBand,
        interestTheme: learners.interestTheme,
      })
      .from(learners)
      .where(eq(learners.id, learnerId))
      .limit(1);

    const row = learnerRows[0];
    if (row === undefined) return null;

    const parsedLearner = learnerRowSchema.safeParse(row);
    if (!parsedLearner.success) {
      console.error("[learner] stored row failed validation", parsedLearner.error.message);
      return null;
    }

    const { gradeBand, interestTheme } = parsedLearner.data;

    /*
     * Every band's climb is read, not only the one being climbed now: the
     * progress screen lays them side by side, and the other bands' rows stay
     * exactly where they are, which is what makes switching band a change of
     * climb rather than a reset of one. A band with no rows is a fresh climb.
     */
    const bandRows = await db
      .select({
        gradeBand: bandProgress.gradeBand,
        totalSolves: bandProgress.totalSolves,
        checkpointsPassed: bandProgress.checkpointsPassed,
      })
      .from(bandProgress)
      .where(eq(bandProgress.learnerId, learnerId));

    const masteryRows = await db
      .select({
        gradeBand: campMastery.gradeBand,
        campNumber: campMastery.campNumber,
        mastery: campMastery.mastery,
        touchedAtSolve: campMastery.touchedAtSolve,
      })
      .from(campMastery)
      .where(eq(campMastery.learnerId, learnerId));

    const totals: Record<GradeBand, { totalSolves: number; checkpointsPassed: number }> = {
      "k-1": { totalSolves: 0, checkpointsPassed: 0 },
      "2-3": { totalSolves: 0, checkpointsPassed: 0 },
      "4-5": { totalSolves: 0, checkpointsPassed: 0 },
    };
    for (const bandRow of bandRows) {
      const parsed = bandRowSchema.safeParse(bandRow);
      if (parsed.success) {
        totals[parsed.data.gradeBand] = {
          totalSolves: parsed.data.totalSolves,
          checkpointsPassed: parsed.data.checkpointsPassed,
        };
      } else {
        console.error("[learner] skipping invalid band row", parsed.error.message);
      }
    }

    const camps: Record<GradeBand, Record<CampNumber, CampRecord>> = {
      "k-1": { 1: NO_RECORD, 2: NO_RECORD, 3: NO_RECORD, 4: NO_RECORD },
      "2-3": { 1: NO_RECORD, 2: NO_RECORD, 3: NO_RECORD, 4: NO_RECORD },
      "4-5": { 1: NO_RECORD, 2: NO_RECORD, 3: NO_RECORD, 4: NO_RECORD },
    };
    for (const masteryRow of masteryRows) {
      const parsed = masteryRowSchema.safeParse(masteryRow);
      // A row outside the known camps or meter range is ignored rather than
      // trusted; the rest of the learner's progress still loads.
      if (parsed.success) {
        camps[parsed.data.gradeBand][parsed.data.campNumber] = {
          earned: parsed.data.mastery,
          touchedAtSolve: parsed.data.touchedAtSolve,
        };
      } else {
        console.error("[learner] skipping invalid mastery row", parsed.error.message);
      }
    }

    const climbOf = (band: GradeBand): BandClimb => ({
      progress: { totalSolves: totals[band].totalSolves, camps: camps[band] },
      checkpointsPassed: totals[band].checkpointsPassed,
    });
    const climbs: Record<GradeBand, BandClimb> = {
      "k-1": climbOf("k-1"),
      "2-3": climbOf("2-3"),
      "4-5": climbOf("4-5"),
    };

    const dayRows = await db
      .select({
        gradeBand: climbDays.gradeBand,
        localDate: climbDays.localDate,
        campNumber: climbDays.campNumber,
        solves: climbDays.solves,
        cleanSolves: climbDays.cleanSolves,
      })
      .from(climbDays)
      .where(eq(climbDays.learnerId, learnerId));

    const days: ClimbDay[] = [];
    for (const dayRow of dayRows) {
      const parsed = climbDayRowSchema.safeParse(dayRow);
      if (parsed.success) {
        days.push({
          date: parsed.data.localDate,
          band: parsed.data.gradeBand,
          camp: parsed.data.campNumber,
          solves: parsed.data.solves,
          cleanSolves: parsed.data.cleanSolves,
        });
      } else {
        // A bad log row costs a day off the calendar, never the whole climb.
        console.error("[learner] skipping invalid climb day", parsed.error.message);
      }
    }

    const current = climbs[gradeBand];
    return {
      profile: { gradeBand, interestTheme },
      progress: current.progress,
      checkpointsPassed: current.checkpointsPassed,
      climbs,
      days,
    };
  } catch (error) {
    console.error("[learner] could not load state:", describe(error));
    return null;
  }
}

/** Creates or updates the learner's grade band and interest theme. */
export async function saveProfile(
  learnerId: LearnerId,
  profile: ClimberProfile,
): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;

  try {
    await getDb()
      .insert(learners)
      .values({
        id: learnerId,
        gradeBand: profile.gradeBand,
        interestTheme: profile.interestTheme,
      })
      .onConflictDoUpdate({
        target: learners.id,
        set: {
          gradeBand: profile.gradeBand,
          interestTheme: profile.interestTheme,
          updatedAt: new Date(),
        },
      });
    return true;
  } catch (error) {
    console.error("[learner] could not save profile:", describe(error));
    return false;
  }
}

/**
 * Records one solved problem: the learner's solve count goes up by one, and
 * the camp they solved it in is marked as touched at that count. Every other
 * camp therefore grows one problem staler without being written to — which is
 * why staleness is derived from a counter rather than stored per camp.
 */
export async function recordSolve(
  learnerId: LearnerId,
  solve: SolveRecord,
): Promise<boolean> {
  const { camp } = solve;
  if (!isDatabaseConfigured()) return false;

  // The same rule the screen uses, applied where it cannot be tampered with.
  const gain = masteryGain(solve.clean ? 0 : 1);

  try {
    const db = getDb();

    /*
     * Which band this solve belongs to is the server's to decide, not the
     * client's — it is read from the saved profile, so a crafted request
     * cannot credit a solve to a band the child is not climbing.
     */
    const band = await bandOf(db, learnerId);
    if (band === null) {
      console.error("[learner] no such learner to record a solve for");
      return false;
    }

    const bumped = await db
      .insert(bandProgress)
      .values({ learnerId, gradeBand: band, totalSolves: 1 })
      .onConflictDoUpdate({
        target: [bandProgress.learnerId, bandProgress.gradeBand],
        set: { totalSolves: sql`${bandProgress.totalSolves} + 1`, updatedAt: new Date() },
      })
      .returning({ totalSolves: bandProgress.totalSolves });

    const counted = solveCountSchema.safeParse(bumped[0]);
    if (!counted.success) {
      console.error("[learner] could not count the solve");
      return false;
    }

    await db
      .insert(campMastery)
      .values({
        learnerId,
        gradeBand: band,
        campNumber: camp,
        mastery: gain,
        touchedAtSolve: counted.data.totalSolves,
      })
      .onConflictDoUpdate({
        target: [campMastery.learnerId, campMastery.gradeBand, campMastery.campNumber],
        set: {
          // Added to the stored value in the database rather than read, changed
          // and written back, so two solves racing cannot lose one of the gains.
          // `least` keeps the CHECK constraint's promise that a meter is 0-100.
          mastery: sql`least(${MASTERY_MAX}, ${campMastery.mastery} + ${gain})`,
          touchedAtSolve: counted.data.totalSolves,
          updatedAt: new Date(),
        },
      });

    // The climb log is accumulated per solve, so a child who wanders off
    // mid-sitting still keeps the day — and their streak with it.
    const clean = solve.clean ? 1 : 0;
    await db
      .insert(climbDays)
      .values({
        learnerId,
        gradeBand: band,
        localDate: solve.localDate,
        campNumber: camp,
        solves: 1,
        cleanSolves: clean,
      })
      .onConflictDoUpdate({
        target: [climbDays.learnerId, climbDays.gradeBand, climbDays.localDate, climbDays.campNumber],
        set: {
          solves: sql`${climbDays.solves} + 1`,
          cleanSolves: sql`${climbDays.cleanSolves} + ${clean}`,
          updatedAt: new Date(),
        },
      });
    return true;
  } catch (error) {
    console.error("[learner] could not record solve:", describe(error));
    return false;
  }
}

/**
 * Marks a camp as freshly practised without counting new solves, which is what
 * passing a checkpoint does: the meter springs back to its earned value and
 * nothing else goes staler for having done the review.
 */
export async function refreshCamp(learnerId: LearnerId, camp: CampNumber): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;

  try {
    const db = getDb();
    const band = await bandOf(db, learnerId);
    if (band === null) return false;

    const rows = await db
      .select({ totalSolves: bandProgress.totalSolves })
      .from(bandProgress)
      .where(
        sql`${bandProgress.learnerId} = ${learnerId} and ${bandProgress.gradeBand} = ${band}`,
      )
      .limit(1);

    const counted = solveCountSchema.safeParse(rows[0]);
    if (!counted.success) return false;

    await db
      .update(campMastery)
      .set({ touchedAtSolve: counted.data.totalSolves, updatedAt: new Date() })
      .where(
        sql`${campMastery.learnerId} = ${learnerId} and ${campMastery.gradeBand} = ${band} and ${campMastery.campNumber} = ${camp}`,
      );

    // A review passed is part of this band's climb, so it is counted there.
    await db
      .update(bandProgress)
      .set({
        checkpointsPassed: sql`${bandProgress.checkpointsPassed} + 1`,
        updatedAt: new Date(),
      })
      .where(
        sql`${bandProgress.learnerId} = ${learnerId} and ${bandProgress.gradeBand} = ${band}`,
      );
    return true;
  } catch (error) {
    console.error("[learner] could not refresh camp:", describe(error));
    return false;
  }
}
