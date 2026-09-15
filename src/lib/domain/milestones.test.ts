import { describe, expect, it } from "vitest";
import { milestonesFor, projectDays, type MilestoneInput } from "./milestones";
import { NO_PROGRESS, type LearnerProgress } from "./progress";
import { localDateSchema, type LocalDate } from "./localDate";
import { DAILY_GOAL, type ClimbDay } from "./streak";
import { MASTERY_MAX } from "@/lib/domain/mastery";
import type { CampNumber } from "@/lib/domain/camp";
import type { GradeBand } from "./onboarding";

const d = (value: string): LocalDate => localDateSchema.parse(value);
const TODAY = d("2026-09-11");

const BAND: GradeBand = "2-3";

const day = (date: string, camp: CampNumber, solves: number, cleanSolves = 0): ClimbDay => ({
  date: d(date),
  band: BAND,
  camp,
  solves,
  cleanSolves,
});

function mastered(camp: CampNumber): LearnerProgress {
  return {
    totalSolves: 8,
    camps: {
      1: { earned: camp === 1 ? MASTERY_MAX : 0, touchedAtSolve: 8 },
      2: { earned: camp === 2 ? MASTERY_MAX : 0, touchedAtSolve: 8 },
      3: { earned: camp === 3 ? MASTERY_MAX : 0, touchedAtSolve: 8 },
      4: { earned: camp === 4 ? MASTERY_MAX : 0, touchedAtSolve: 8 },
    },
  };
}

const input = (over: Partial<MilestoneInput> = {}): MilestoneInput => ({
  band: BAND,
  before: NO_PROGRESS,
  after: NO_PROGRESS,
  days: [],
  today: TODAY,
  camp: 1,
  campName: "Trailhead",
  tally: { solved: 3, cleanSolves: 3 },
  checkpointsPassed: 0,
  ...over,
});

const ids = (state: MilestoneInput) => milestonesFor(state).map((milestone) => milestone.id);

describe("a personal best belongs to the band", () => {
  it("does not treat another grade's best day at the same camp as the one to beat", () => {
    // 9 at camp 1 in K-1; then 3 at camp 1 in 2-3 for the first time. That is
    // a first day in 2-3, not a worse day than K-1's, so no best is claimed.
    const otherBand = [{ ...day("2026-09-01", 1, 9, 9), band: "k-1" as const }];
    expect(ids(input({ days: otherBand, tally: { solved: 3, cleanSolves: 3 } }))).not.toContain(
      "personal-best",
    );
  });
});

describe("projectDays", () => {
  it("accumulates onto today's existing row for the same camp", () => {
    const projected = projectDays([day("2026-09-11", 1, 2, 1)], BAND, 1, TODAY, {
      solved: 3,
      cleanSolves: 2,
    });
    expect(projected).toEqual([day("2026-09-11", 1, 5, 3)]);
  });

  it("opens a new row for a different camp on the same day", () => {
    const projected = projectDays([day("2026-09-11", 1, 2, 1)], BAND, 2, TODAY, {
      solved: 3,
      cleanSolves: 0,
    });
    expect(projected).toHaveLength(2);
    expect(projected).toContainEqual(day("2026-09-11", 2, 3, 0));
  });

  it("opens a new row for the same camp on a new day", () => {
    const projected = projectDays([day("2026-09-10", 1, 2, 1)], BAND, 1, TODAY, {
      solved: 1,
      cleanSolves: 1,
    });
    expect(projected).toHaveLength(2);
  });

  it("changes nothing when nothing was solved", () => {
    const days = [day("2026-09-11", 1, 2, 1)];
    expect(projectDays(days, BAND, 1, TODAY, { solved: 0, cleanSolves: 0 })).toBe(days);
  });

  it("leaves the rows it was given untouched", () => {
    const days = [day("2026-09-11", 1, 2, 1)];
    const snapshot = structuredClone(days);
    projectDays(days, BAND, 1, TODAY, { solved: 4, cleanSolves: 4 });
    expect(days).toEqual(snapshot);
  });

  it("never lets clean solves exceed solves", () => {
    for (const solved of [1, 3, 9]) {
      for (const clean of [0, 1, solved]) {
        const projected = projectDays([day("2026-09-11", 1, 2, 2)], BAND, 1, TODAY, {
          solved,
          cleanSolves: clean,
        });
        for (const row of projected) expect(row.cleanSolves).toBeLessThanOrEqual(row.solves);
      }
    }
  });
});

describe("milestonesFor", () => {
  it("claims nothing when nothing was solved", () => {
    expect(milestonesFor(input({ tally: { solved: 0, cleanSolves: 0 } }))).toHaveLength(0);
  });

  it("starts a streak on a first ever sitting", () => {
    const found = ids(input());
    expect(found).toContain("streak-started");
    expect(found).toContain("badge-first-climb");
  });

  it("claims no personal best when there is no previous day to beat", () => {
    expect(ids(input())).not.toContain("personal-best");
  });

  it("claims a personal best once a previous day is beaten", () => {
    const state = input({ days: [day("2026-09-09", 1, 4)], tally: { solved: 6, cleanSolves: 0 } });
    const best = milestonesFor(state).find((milestone) => milestone.id === "personal-best");
    expect(best).toBeDefined();
    expect(best?.detail).toContain("6");
    expect(best?.detail).toContain("Trailhead");
  });

  it("claims no personal best when the previous day still stands", () => {
    const state = input({ days: [day("2026-09-09", 1, 9)], tally: { solved: 6, cleanSolves: 0 } });
    expect(ids(state)).not.toContain("personal-best");
  });

  it("compares bests per camp, not across them", () => {
    // A big day at camp 2 does not stop camp 1 setting its own best.
    const state = input({
      days: [day("2026-09-09", 1, 2), day("2026-09-09", 2, 30)],
      tally: { solved: 4, cleanSolves: 0 },
    });
    expect(ids(state)).toContain("personal-best");
  });

  it("announces the daily goal only when this sitting crossed it", () => {
    expect(ids(input({ tally: { solved: DAILY_GOAL, cleanSolves: 0 } }))).toContain("daily-goal");
    // Already met earlier today, so it is not new.
    const already = input({
      days: [day("2026-09-11", 2, DAILY_GOAL)],
      tally: { solved: 1, cleanSolves: 0 },
    });
    expect(ids(already)).not.toContain("daily-goal");
  });

  it("does not re-announce a streak on a second sitting the same day", () => {
    const state = input({ days: [day("2026-09-11", 1, 3)], tally: { solved: 2, cleanSolves: 0 } });
    expect(ids(state).filter((id) => id.startsWith("streak"))).toHaveLength(0);
  });

  it("extends a streak and names the new length", () => {
    const state = input({ days: [day("2026-09-10", 1, 3)] });
    const extended = milestonesFor(state).find((milestone) => milestone.id === "streak-extended");
    expect(extended?.headline).toBe("2-day streak");
  });

  it("says so when the run is the longest ever", () => {
    const state = input({ days: [day("2026-09-10", 1, 3)] });
    expect(
      milestonesFor(state).find((milestone) => milestone.id === "streak-extended")?.detail,
    ).toContain("longest");
  });

  it("invites tomorrow when the run is not a record", () => {
    // A nine-day run back in June is the record; a new two-day run is not.
    const june = Array.from({ length: 9 }, (_, i) =>
      day(new Date(Date.UTC(2026, 5, 1 + i)).toISOString().slice(0, 10), 1, 1),
    );
    const state = input({ days: [...june, day("2026-09-10", 1, 3)] });
    expect(
      milestonesFor(state).find((milestone) => milestone.id === "streak-extended")?.detail,
    ).toContain("tomorrow");
  });

  it("announces a badge the sitting earned", () => {
    const state = input({ before: NO_PROGRESS, after: mastered(1) });
    const badge = milestonesFor(state).find((milestone) => milestone.id === "badge-camp-mastered");
    expect(badge?.headline).toContain("Camp Master");
  });

  it("does not announce a badge that was already held", () => {
    const state = input({ before: mastered(1), after: mastered(1) });
    expect(ids(state)).not.toContain("badge-camp-mastered");
  });

  it("gives every milestone a unique id and something to say", () => {
    const states = [
      input(),
      input({ tally: { solved: DAILY_GOAL, cleanSolves: DAILY_GOAL }, after: mastered(1) }),
      input({ days: [day("2026-09-09", 1, 2), day("2026-09-10", 1, 1)], tally: { solved: 9, cleanSolves: 9 } }),
    ];
    for (const state of states) {
      const milestones = milestonesFor(state);
      expect(new Set(milestones.map((milestone) => milestone.id)).size).toBe(milestones.length);
      for (const milestone of milestones) {
        expect(milestone.headline.length).toBeGreaterThan(0);
        expect(milestone.detail.length).toBeGreaterThan(0);
        expect(milestone.glyph.length).toBeGreaterThan(0);
      }
    }
  });

  it("agrees with the climb log: what it claims, the log then shows", () => {
    const days = [day("2026-09-09", 1, 4)];
    const tally = { solved: 6, cleanSolves: 6 };
    const claimed = milestonesFor(input({ days, tally }));
    if (claimed.some((milestone) => milestone.id === "personal-best")) {
      const projected = projectDays(days, BAND, 1, TODAY, tally);
      const best = Math.max(...projected.filter((row) => row.camp === 1).map((row) => row.solves));
      expect(best).toBe(6);
    }
  });
});
