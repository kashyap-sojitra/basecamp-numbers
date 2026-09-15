import { describe, expect, it } from "vitest";
import { buildSessionSummary, projectProgress } from "./sessionSummary";
import { NO_PROGRESS, type LearnerProgress } from "./progress";
import { CAMP_NUMBERS, type CampNumber } from "@/lib/domain/camp";
import { MASTERY_MAX } from "@/lib/domain/mastery";
import { DECAY_GRACE_SOLVES } from "./decay";
import { starsForSession } from "./stars";

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

describe("projectProgress", () => {
  it("adds this sitting's solves to the running total", () => {
    expect(projectProgress(NO_PROGRESS, 1, 5, 70).totalSolves).toBe(5);
  });

  it("raises the practised camp's earned meter", () => {
    const after = projectProgress(NO_PROGRESS, 1, 5, 70);
    expect(after.camps[1].earned).toBe(70);
  });

  it("never lowers a meter, even if the session's reading is behind", () => {
    const before = progressOf(10, { 1: { earned: 90, touchedAtSolve: 10 } });
    expect(projectProgress(before, 1, 2, 40).camps[1].earned).toBe(90);
  });

  it("marks the camp as freshly practised at the new solve count", () => {
    const after = projectProgress(NO_PROGRESS, 2, 4, 50);
    expect(after.camps[2].touchedAtSolve).toBe(4);
  });

  it("does not mark a camp practised when nothing was solved", () => {
    const before = progressOf(10, { 3: { earned: 20, touchedAtSolve: 2 } });
    expect(projectProgress(before, 3, 0, 20).camps[3].touchedAtSolve).toBe(2);
  });

  it("leaves the other camps' records alone", () => {
    const before = progressOf(10, {
      1: { earned: 100, touchedAtSolve: 10 },
      2: { earned: 30, touchedAtSolve: 4 },
    });
    const after = projectProgress(before, 1, 3, 100);
    expect(after.camps[2]).toEqual(before.camps[2]);
  });

  it("makes the other camps staler, since solving here is what dims them", () => {
    const before = progressOf(0, { 1: { earned: 100, touchedAtSolve: 0 } });
    const after = projectProgress(before, 2, DECAY_GRACE_SOLVES + 5, 60);
    // Camp 1 was not touched, so its staleness is now the new total.
    expect(after.totalSolves - after.camps[1].touchedAtSolve).toBe(DECAY_GRACE_SOLVES + 5);
  });

  it("does not mutate the record it was given", () => {
    const before = progressOf(3, { 1: { earned: 10, touchedAtSolve: 3 } });
    const snapshot = structuredClone(before);
    projectProgress(before, 1, 4, 80);
    expect(before).toEqual(snapshot);
  });
});

describe("buildSessionSummary", () => {
  it("reports every camp, in order, flagging the one practised", () => {
    const summary = buildSessionSummary(NO_PROGRESS, 2, { solved: 4, cleanSolves: 3 }, 60);
    expect(summary.camps.map((delta) => delta.camp)).toEqual([...CAMP_NUMBERS]);
    expect(summary.camps.filter((delta) => delta.practised).map((delta) => delta.camp)).toEqual([2]);
  });

  it("shows the practised camp's meter rising", () => {
    const summary = buildSessionSummary(NO_PROGRESS, 1, { solved: 4, cleanSolves: 4 }, 56);
    const camp1 = summary.camps.find((delta) => delta.camp === 1);
    expect(camp1?.before.shown).toBe(0);
    expect(camp1?.after.shown).toBe(56);
    expect(summary.masteryRose).toBe(true);
  });

  it("shows earlier camps slipping as a result of this sitting", () => {
    const before = progressOf(0, { 1: { earned: MASTERY_MAX, touchedAtSolve: 0 } });
    const summary = buildSessionSummary(before, 2, { solved: 40, cleanSolves: 40 }, 60);
    const camp1 = summary.camps.find((delta) => delta.camp === 1);
    expect(camp1?.after.shown).toBeLessThan(camp1?.before.shown ?? 0);
  });

  it("says the meter did not rise when the camp was already full", () => {
    const before = progressOf(8, { 1: { earned: MASTERY_MAX, touchedAtSolve: 8 } });
    const summary = buildSessionSummary(before, 1, { solved: 3, cleanSolves: 3 }, MASTERY_MAX);
    expect(summary.masteryRose).toBe(false);
    expect(summary.campCompleted).toBe(false);
  });

  it("flags the moment a camp is completed, once only", () => {
    const firstTime = buildSessionSummary(
      progressOf(7, { 1: { earned: 90, touchedAtSolve: 7 } }),
      1,
      { solved: 1, cleanSolves: 1 },
      MASTERY_MAX,
    );
    expect(firstTime.campCompleted).toBe(true);

    const again = buildSessionSummary(
      progressOf(8, { 1: { earned: MASTERY_MAX, touchedAtSolve: 8 } }),
      1,
      { solved: 1, cleanSolves: 1 },
      MASTERY_MAX,
    );
    expect(again.campCompleted).toBe(false);
  });

  it("carries the tally and the stars the star rule gives", () => {
    const tally = { solved: 9, cleanSolves: 8 };
    const summary = buildSessionSummary(NO_PROGRESS, 1, tally, 80);
    expect(summary.tally).toEqual(tally);
    expect(summary.stars).toBe(starsForSession(tally));
  });

  it("describes the shape of the sitting for the AI line, one word per rating", () => {
    const shapes = [
      buildSessionSummary(NO_PROGRESS, 1, { solved: 0, cleanSolves: 0 }, 0).shape,
      buildSessionSummary(NO_PROGRESS, 1, { solved: 2, cleanSolves: 0 }, 14).shape,
      buildSessionSummary(NO_PROGRESS, 1, { solved: 9, cleanSolves: 2 }, 50).shape,
      buildSessionSummary(NO_PROGRESS, 1, { solved: 9, cleanSolves: 9 }, 90).shape,
    ];
    expect(shapes).toEqual(["nothing", "wobbly", "steady", "strong"]);
  });

  it("never reports a meter outside the meter's range", () => {
    for (const solved of [0, 1, 7, 40]) {
      const summary = buildSessionSummary(
        progressOf(5, { 1: { earned: 90, touchedAtSolve: 5 } }),
        1,
        { solved, cleanSolves: solved },
        MASTERY_MAX,
      );
      for (const delta of summary.camps) {
        for (const view of [delta.before, delta.after]) {
          expect(view.shown).toBeGreaterThanOrEqual(0);
          expect(view.shown).toBeLessThanOrEqual(MASTERY_MAX);
          expect(view.shown).toBeLessThanOrEqual(view.earned);
        }
      }
    }
  });
});
