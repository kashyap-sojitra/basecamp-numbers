import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClimberProfile } from "@/lib/domain/onboarding";
import { bandProgress, campMastery, climbDays, learners } from "./schema";

/* -------------------------------------------------------------------------- */
/* A fake Drizzle, recording what the repository asks the database to do.      */

interface Recorded {
  readonly kind: "select" | "insert" | "update";
  readonly table: string;
}

const recorded: Recorded[] = [];

/** Rows the next select should return, queued in call order. */
let selectQueue: unknown[][] = [];
/** Rows the next `returning()` should give back. */
let returningQueue: unknown[][] = [];
/** When set, the next database call throws — the connection-lost case. */
let failWith: Error | null = null;

/**
 * Names a table by identity against the schema, rather than by reading
 * Drizzle's internals — which are not part of its API.
 */
function tableName(table: unknown): string {
  if (table === learners) return "learners";
  if (table === bandProgress) return "band_progress";
  if (table === campMastery) return "camp_mastery";
  if (table === climbDays) return "climb_days";
  return "unknown";
}

function nextSelect(): unknown[] {
  if (failWith !== null) throw failWith;
  return selectQueue.shift() ?? [];
}

function makeDb() {
  return {
    select: () => ({
      from: (table: unknown) => {
        recorded.push({ kind: "select", table: tableName(table) });
        const rows = nextSelect();
        const result = {
          where: () => ({
            limit: () => Promise.resolve(rows),
            then: (resolve: (value: unknown[]) => unknown) => resolve(rows),
          }),
        };
        return result;
      },
    }),
    insert: (table: unknown) => {
      recorded.push({ kind: "insert", table: tableName(table) });
      if (failWith !== null) throw failWith;
      return {
        values: () => ({
          /*
           * Awaiting it yields nothing, and `returning()` yields the queued
           * rows — the queue is read lazily so an upsert that does not ask for
           * its row cannot consume another one's answer.
           */
          onConflictDoUpdate: () => ({
            returning: () => Promise.resolve(returningQueue.shift() ?? []),
            then: (resolve: (value: unknown) => unknown) => resolve(undefined),
          }),
        }),
      };
    },
    update: (table: unknown) => {
      recorded.push({ kind: "update", table: tableName(table) });
      if (failWith !== null) throw failWith;
      return {
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve(returningQueue.shift() ?? []),
            then: (resolve: (value: unknown) => unknown) => resolve(undefined),
          }),
        }),
      };
    },
  };
}

let configured = true;

vi.mock("./client", () => ({
  isDatabaseConfigured: () => configured,
  getDb: () => makeDb(),
}));

const { loadLearnerState, recordSolve, refreshCamp, saveProfile } = await import(
  "./learnerRepository"
);

const LEARNER = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const PROFILE: ClimberProfile = { gradeBand: "2-3", interestTheme: "ocean" };

const learnerRow = {
  gradeBand: "2-3",
  interestTheme: "ocean",
};

/** The counters for the band the learner row says they are climbing. */
const bandRow = { gradeBand: "2-3", totalSolves: 12, checkpointsPassed: 1 };

beforeEach(() => {
  recorded.length = 0;
  selectQueue = [];
  returningQueue = [];
  failWith = null;
  configured = true;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

/* -------------------------------------------------------------------------- */

describe("loadLearnerState", () => {
  it("returns null when no database is configured, so the app still runs", async () => {
    configured = false;
    await expect(loadLearnerState(LEARNER)).resolves.toBeNull();
  });

  it("returns null for a learner with no saved row", async () => {
    selectQueue = [[]];
    await expect(loadLearnerState(LEARNER)).resolves.toBeNull();
  });

  it("returns the profile, the meters and the climb log", async () => {
    selectQueue = [
      [learnerRow],
      [bandRow],
      [{ gradeBand: "2-3", campNumber: 1, mastery: 100, touchedAtSolve: 8 }],
      [{ gradeBand: "2-3", localDate: "2026-09-11", campNumber: 1, solves: 4, cleanSolves: 3 }],
    ];
    const state = await loadLearnerState(LEARNER);
    expect(state?.profile).toEqual(PROFILE);
    expect(state?.progress.totalSolves).toBe(12);
    expect(state?.progress.camps[1]).toEqual({ earned: 100, touchedAtSolve: 8 });
    expect(state?.checkpointsPassed).toBe(1);
    expect(state?.days).toEqual([
      { date: "2026-09-11", band: "2-3", camp: 1, solves: 4, cleanSolves: 3 },
    ]);
  });

  it("reads every band's climb, so the progress screen can lay them side by side", async () => {
    selectQueue = [
      [learnerRow],
      [bandRow, { gradeBand: "k-1", totalSolves: 33, checkpointsPassed: 2 }],
      [
        { gradeBand: "k-1", campNumber: 4, mastery: 100, touchedAtSolve: 33 },
        { gradeBand: "2-3", campNumber: 1, mastery: 14, touchedAtSolve: 1 },
      ],
      [],
    ];
    const state = await loadLearnerState(LEARNER);
    expect(state?.climbs["k-1"].progress.totalSolves).toBe(33);
    expect(state?.climbs["k-1"].progress.camps[4].earned).toBe(100);
    expect(state?.climbs["k-1"].checkpointsPassed).toBe(2);
    expect(state?.climbs["2-3"].progress.camps[1].earned).toBe(14);
    expect(state?.climbs["4-5"].progress.totalSolves).toBe(0);
    // The current band is the one the top-level fields describe.
    expect(state?.progress).toEqual(state?.climbs["2-3"].progress);
  });

  it("gives every camp a record, even the ones never visited", async () => {
    selectQueue = [[learnerRow], [], [], []];
    const state = await loadLearnerState(LEARNER);
    for (const camp of [1, 2, 3, 4] as const) {
      expect(state?.progress.camps[camp]).toEqual({ earned: 0, touchedAtSolve: 0 });
    }
  });

  it("refuses a learner row that fails validation rather than guessing", async () => {
    selectQueue = [[{ ...learnerRow, gradeBand: "grade-9" }]];
    await expect(loadLearnerState(LEARNER)).resolves.toBeNull();
  });

  it("skips a bad mastery row and keeps the rest of the climb", async () => {
    selectQueue = [
      [learnerRow],
      [bandRow],
      [
        { gradeBand: "2-3", campNumber: 9, mastery: 50, touchedAtSolve: 1 },
        { gradeBand: "2-3", campNumber: 2, mastery: 500, touchedAtSolve: 1 },
        { gradeBand: "2-3", campNumber: 3, mastery: 40, touchedAtSolve: 2 },
      ],
      [],
    ];
    const state = await loadLearnerState(LEARNER);
    expect(state?.progress.camps[3]).toEqual({ earned: 40, touchedAtSolve: 2 });
    expect(state?.progress.camps[2].earned).toBe(0);
  });

  it("skips a bad climb-log row and keeps the other days", async () => {
    selectQueue = [
      [learnerRow],
      [bandRow],
      [],
      [
        { gradeBand: "2-3", localDate: "2026-02-30", campNumber: 1, solves: 1, cleanSolves: 0 },
        { gradeBand: "2-3", localDate: "2026-09-10", campNumber: 1, solves: 2, cleanSolves: 2 },
      ],
    ];
    const state = await loadLearnerState(LEARNER);
    expect(state?.days).toHaveLength(1);
    expect(state?.days[0]?.date).toBe("2026-09-10");
  });

  /*
   * The bug this keying exists to stop: a child who finished camp 1 as K-1 and
   * then picked 2-3 met a full meter and an unlocked camp 2 without having
   * solved one 2-3 problem.
   */
  it("describes the band the child is climbing, so a new band starts fresh", async () => {
    selectQueue = [
      [{ gradeBand: "2-3", interestTheme: "ocean" }],
      // K-1 was climbed; 2-3 has no counter and no meters: this climb has not started.
      [{ gradeBand: "k-1", totalSolves: 33, checkpointsPassed: 2 }],
      [{ gradeBand: "k-1", campNumber: 1, mastery: 100, touchedAtSolve: 8 }],
      [{ gradeBand: "k-1", localDate: "2026-09-11", campNumber: 1, solves: 4, cleanSolves: 3 }],
    ];

    const state = await loadLearnerState(LEARNER);

    expect(state?.profile.gradeBand).toBe("2-3");
    expect(state?.progress.totalSolves).toBe(0);
    expect(state?.checkpointsPassed).toBe(0);
    for (const camp of [1, 2, 3, 4] as const) {
      expect(state?.progress.camps[camp]).toEqual({ earned: 0, touchedAtSolve: 0 });
    }
    // The climb log is the child turning up, so every band's rows are there —
    // tagged with their band, so the climb rules can leave the others out.
    expect(state?.days).toHaveLength(1);
    expect(state?.days[0]?.band).toBe("k-1");
  });

  it("gives a band back exactly as it was left when the child returns to it", async () => {
    selectQueue = [
      [{ gradeBand: "k-1", interestTheme: "ocean" }],
      [{ gradeBand: "k-1", totalSolves: 20, checkpointsPassed: 1 }],
      [{ gradeBand: "k-1", campNumber: 1, mastery: 100, touchedAtSolve: 20 }],
      [],
    ];

    const state = await loadLearnerState(LEARNER);

    expect(state?.progress.totalSolves).toBe(20);
    expect(state?.progress.camps[1]).toEqual({ earned: 100, touchedAtSolve: 20 });
  });

  it("returns null when the connection is lost, costing progress but not the game", async () => {
    failWith = new Error("connection terminated");
    await expect(loadLearnerState(LEARNER)).resolves.toBeNull();
  });
});

describe("saveProfile", () => {
  it("reports failure when there is no database", async () => {
    configured = false;
    await expect(saveProfile(LEARNER, PROFILE)).resolves.toBe(false);
  });

  it("upserts the learner", async () => {
    await expect(saveProfile(LEARNER, PROFILE)).resolves.toBe(true);
    expect(recorded).toEqual([{ kind: "insert", table: "learners" }]);
  });

  it("reports failure rather than throwing when the write fails", async () => {
    failWith = new Error("unique violation");
    await expect(saveProfile(LEARNER, PROFILE)).resolves.toBe(false);
  });
});

describe("recordSolve", () => {
  const solve = {
    camp: 1 as const,
    mastery: 42,
    localDate: "2026-09-11" as never,
    clean: true,
  };

  it("reports failure when there is no database", async () => {
    configured = false;
    await expect(recordSolve(LEARNER, solve)).resolves.toBe(false);
  });

  it("bumps the band's solve count, then writes the meter and the climb day", async () => {
    selectQueue = [[{ gradeBand: "2-3" }]];
    returningQueue = [[{ totalSolves: 13 }]];
    await expect(recordSolve(LEARNER, solve)).resolves.toBe(true);
    expect(recorded).toEqual([
      // The band is read from the profile, never taken from the request.
      { kind: "select", table: "learners" },
      { kind: "insert", table: "band_progress" },
      { kind: "insert", table: "camp_mastery" },
      { kind: "insert", table: "climb_days" },
    ]);
  });

  it("refuses to record a solve for a learner that does not exist", async () => {
    selectQueue = [[]];
    await expect(recordSolve(LEARNER, solve)).resolves.toBe(false);
    // ...and does not write a counter, a meter or a day for them.
    expect(recorded.map((entry) => entry.table)).toEqual(["learners"]);
  });

  it("reports failure rather than throwing when the write fails", async () => {
    failWith = new Error("deadlock detected");
    await expect(recordSolve(LEARNER, solve)).resolves.toBe(false);
  });
});

describe("refreshCamp", () => {
  it("reports failure when there is no database", async () => {
    configured = false;
    await expect(refreshCamp(LEARNER, 1)).resolves.toBe(false);
  });

  it("marks the camp fresh and counts the checkpoint", async () => {
    selectQueue = [[{ gradeBand: "2-3" }], [{ totalSolves: 30 }]];
    await expect(refreshCamp(LEARNER, 2)).resolves.toBe(true);
    expect(recorded).toEqual([
      { kind: "select", table: "learners" },
      { kind: "select", table: "band_progress" },
      { kind: "update", table: "camp_mastery" },
      // A review passed is part of this band's climb, so it is counted there.
      { kind: "update", table: "band_progress" },
    ]);
  });

  it("does nothing for a learner that does not exist", async () => {
    selectQueue = [[]];
    await expect(refreshCamp(LEARNER, 2)).resolves.toBe(false);
    expect(recorded.map((entry) => entry.kind)).toEqual(["select"]);
  });

  it("reports failure rather than throwing when the write fails", async () => {
    failWith = new Error("connection lost");
    await expect(refreshCamp(LEARNER, 1)).resolves.toBe(false);
  });
});
