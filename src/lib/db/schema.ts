import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * These mirror the Zod enums in the domain. Keeping them as real Postgres
 * enums means a bad value cannot reach the database in the first place.
 */
export const gradeBandEnum = pgEnum("grade_band", ["k-1", "2-3", "4-5"]);
export const interestThemeEnum = pgEnum("interest_theme", ["space", "ocean", "jungle"]);

/**
 * One anonymous learner, identified only by the UUID in their cookie. There is
 * deliberately nothing here that could identify a child: no name, no email,
 * no login. Accounts are out of scope.
 */
export const learners = pgTable("learners", {
  id: uuid("id").primaryKey(),
  gradeBand: gradeBandEnum("grade_band").notNull(),
  interestTheme: interestThemeEnum("interest_theme").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Per-band state: how many problems this child has solved *in this band*.
 *
 * Mastery decay and the problem ladder are both measured against this, and it
 * is per band for the same reason the meters are: the bands are separate
 * climbs. Solving in 2-3 must not dim a K-1 camp that was finished weeks ago.
 */
export const bandProgress = pgTable(
  "band_progress",
  {
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    gradeBand: gradeBandEnum("grade_band").notNull(),
    totalSolves: integer("total_solves").notNull().default(0),
    /**
     * Checkpoint reviews passed in this band. The one badge condition that is
     * a past event rather than a state of the meters, so it cannot be derived
     * and is counted here — per band, because a review is part of a climb.
     */
    checkpointsPassed: integer("checkpoints_passed").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.learnerId, table.gradeBand] }),
    check("band_total_solves_not_negative", sql`${table.totalSolves} >= 0`),
    check("band_checkpoints_not_negative", sql`${table.checkpointsPassed} >= 0`),
  ],
);

/**
 * A learner's Mastery Meter for one camp **of one grade band**. The checks
 * encode two rules from CLAUDE.md that must hold even if a bug tries to write
 * past them: there are exactly four camps, and a meter runs 0-100.
 *
 * The band is part of the key because each band is its own climb. Without it,
 * a child who finished camp 1 as K-1 and then switched to 2-3 found camp 1
 * already full and camp 2 unlocked, having never solved a 2-3 problem.
 */
export const campMastery = pgTable(
  "camp_mastery",
  {
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    gradeBand: gradeBandEnum("grade_band").notNull(),
    campNumber: smallint("camp_number").notNull(),
    /** The highest the meter has reached here. Decay never lowers it. */
    mastery: smallint("mastery").notNull().default(0),
    /** The learner's solve count when this camp was last practised. */
    touchedAtSolve: integer("touched_at_solve").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.learnerId, table.gradeBand, table.campNumber] }),
    check("camp_number_is_one_of_four", sql`${table.campNumber} between 1 and 4`),
    check("mastery_within_meter", sql`${table.mastery} between 0 and 100`),
    check("touched_at_solve_not_negative", sql`${table.touchedAtSolve} >= 0`),
    index("camp_mastery_learner_idx").on(table.learnerId, table.gradeBand),
  ],
);

/**
 * One camp's work on one calendar day, in the *child's* timezone — the log the
 * streak, the badges and the personal bests are all derived from.
 *
 * The band is on the row and in the key because the log serves two scopes:
 * the streak and the calendar are the child's and read every row, while
 * solves, bests and the climbing badges are the band's and read only its
 * rows. It is always read whole, per learner, and filtered in the domain.
 *
 * Rows accumulate on every solve rather than being written once at the end of
 * a sitting, so a child who closes the tab without tapping Finish still keeps
 * the day. The day is supplied by the client because a day boundary computed
 * in UTC would break streaks for most of the world.
 */
export const climbDays = pgTable(
  "climb_days",
  {
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    gradeBand: gradeBandEnum("grade_band").notNull(),
    /** `YYYY-MM-DD` as the child's own clock read it. */
    localDate: date("local_date", { mode: "string" }).notNull(),
    campNumber: smallint("camp_number").notNull(),
    solves: integer("solves").notNull().default(0),
    /** Of those, how many were right first time. */
    cleanSolves: integer("clean_solves").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.learnerId, table.gradeBand, table.localDate, table.campNumber] }),
    check("climb_camp_is_one_of_four", sql`${table.campNumber} between 1 and 4`),
    check("climb_solves_not_negative", sql`${table.solves} >= 0`),
    // A clean solve is a solve, so this can never exceed the total.
    check(
      "climb_clean_within_solves",
      sql`${table.cleanSolves} >= 0 and ${table.cleanSolves} <= ${table.solves}`,
    ),
    index("climb_days_learner_idx").on(table.learnerId),
  ],
);
