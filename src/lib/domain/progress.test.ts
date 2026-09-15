import { describe, expect, it } from "vitest";
import { campsWithProgress, deriveCampProgress, NO_PROGRESS } from "./progress";
import type { LearnerProgress } from "./progress";
import { CAMP_DEFINITIONS } from "@/lib/data/camps";
import { CAMP_NUMBERS, type CampNumber } from "@/lib/domain/camp";
import { MASTERY_MAX, UNLOCK_MASTERY } from "@/lib/domain/mastery";

function progressOf(
  totalSolves: number,
  camps: Partial<Record<CampNumber, { earned: number; touchedAtSolve: number }>>,
): LearnerProgress {
  return {
    totalSolves,
    camps: {
      1: camps[1] ?? { earned: 0, touchedAtSolve: 0 },
      2: camps[2] ?? { earned: 0, touchedAtSolve: 0 },
      3: camps[3] ?? { earned: 0, touchedAtSolve: 0 },
      4: camps[4] ?? { earned: 0, touchedAtSolve: 0 },
    },
  };
}

describe("deriveCampProgress", () => {
  it("opens camp 1 for a brand new climber and locks the rest", () => {
    expect(deriveCampProgress(1, NO_PROGRESS)).toEqual({ status: "open", mastery: 0, earned: 0 });
    for (const camp of [2, 3, 4] as const) {
      expect(deriveCampProgress(camp, NO_PROGRESS)).toEqual({
        status: "locked",
        unlocksAfter: camp - 1,
      });
    }
  });

  it("opens the next camp the moment the one below fills", () => {
    const progress = progressOf(8, { 1: { earned: MASTERY_MAX, touchedAtSolve: 8 } });
    expect(deriveCampProgress(2, progress).status).toBe("open");
  });

  it("keeps the next camp locked one point short of full", () => {
    const progress = progressOf(8, { 1: { earned: UNLOCK_MASTERY - 1, touchedAtSolve: 8 } });
    expect(deriveCampProgress(2, progress)).toEqual({ status: "locked", unlocksAfter: 1 });
  });

  it("unlocks from the earned meter, so decay can never re-lock a camp", () => {
    // Camp 1 is mastered but long untouched: its shown meter is dimmed, yet
    // camp 2 must stay reachable.
    const progress = progressOf(500, {
      1: { earned: MASTERY_MAX, touchedAtSolve: 0 },
      2: { earned: MASTERY_MAX, touchedAtSolve: 500 },
    });
    expect(deriveCampProgress(2, progress).status).not.toBe("locked");
    expect(deriveCampProgress(3, progress).status).not.toBe("locked");
  });

  it("gates an unlocked camp behind a checkpoint when a camp below has gone dim", () => {
    const progress = progressOf(500, {
      1: { earned: MASTERY_MAX, touchedAtSolve: 0 },
      2: { earned: MASTERY_MAX, touchedAtSolve: 500 },
    });
    const camp3 = deriveCampProgress(3, progress);
    expect(camp3.status).toBe("checkpoint");
    if (camp3.status === "checkpoint") expect(camp3.reviewOf).toBe(1);
  });

  it("never gates camp 1 itself", () => {
    const progress = progressOf(500, { 1: { earned: MASTERY_MAX, touchedAtSolve: 0 } });
    expect(deriveCampProgress(1, progress).status).toBe("open");
  });

  it("shows the dimmed meter but keeps the earned one alongside it", () => {
    const progress = progressOf(500, { 1: { earned: MASTERY_MAX, touchedAtSolve: 0 } });
    const camp1 = deriveCampProgress(1, progress);
    if (camp1.status === "locked") throw new Error("camp 1 is never locked");
    expect(camp1.earned).toBe(MASTERY_MAX);
    expect(camp1.mastery).toBeLessThan(camp1.earned);
  });

  it("gives a locked camp no meter at all, by construction", () => {
    const locked = deriveCampProgress(4, NO_PROGRESS);
    expect(locked).not.toHaveProperty("mastery");
    expect(locked).not.toHaveProperty("earned");
  });

  it("never reports a status outside the three it declares", () => {
    for (let solves = 0; solves <= 120; solves += 7) {
      for (const earned of [0, 50, MASTERY_MAX]) {
        const progress = progressOf(solves, {
          1: { earned, touchedAtSolve: 0 },
          2: { earned, touchedAtSolve: solves },
          3: { earned, touchedAtSolve: solves },
        });
        for (const camp of CAMP_NUMBERS) {
          expect(["open", "locked", "checkpoint"]).toContain(
            deriveCampProgress(camp, progress).status,
          );
        }
      }
    }
  });
});

describe("campsWithProgress", () => {
  it("returns all four camps, in order, with their definitions intact", () => {
    const camps = campsWithProgress(CAMP_DEFINITIONS, NO_PROGRESS);
    expect(camps).toHaveLength(4);
    expect(camps.map((camp) => camp.number)).toEqual([1, 2, 3, 4]);
    expect(camps.map((camp) => camp.name)).toEqual(CAMP_DEFINITIONS.map((c) => c.name));
  });

  it("attaches the same progress the rule derives on its own", () => {
    const progress = progressOf(8, { 1: { earned: MASTERY_MAX, touchedAtSolve: 8 } });
    for (const camp of campsWithProgress(CAMP_DEFINITIONS, progress)) {
      expect(camp.progress).toEqual(deriveCampProgress(camp.number, progress));
    }
  });
});
