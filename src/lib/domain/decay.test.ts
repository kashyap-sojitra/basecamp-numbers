import { describe, expect, it } from "vitest";
import {
  CHECKPOINT_QUESTIONS,
  CHECKPOINT_THRESHOLD,
  DECAY_FLOOR,
  DECAY_GRACE_SOLVES,
  DECAY_PER_SOLVE,
  NO_PROGRESS,
  campNeedingReview,
  dimmedMastery,
  masteryView,
  solvesElsewhere,
  type LearnerProgress,
} from "./decay";
import { CAMP_NUMBERS, type CampNumber } from "@/lib/domain/camp";
import { MASTERY_MAX, UNLOCK_MASTERY, masteryGain } from "@/lib/domain/mastery";

/** A learner record built from per-camp (earned, touchedAtSolve) pairs. */
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

describe("the decay constants", () => {
  it("leave a grace period, a real slope and a floor above zero", () => {
    expect(DECAY_GRACE_SOLVES).toBeGreaterThan(0);
    expect(DECAY_PER_SOLVE).toBeGreaterThan(0);
    expect(DECAY_FLOOR).toBeGreaterThan(0);
    expect(DECAY_FLOOR).toBeLessThan(CHECKPOINT_THRESHOLD);
    expect(CHECKPOINT_THRESHOLD).toBeLessThan(MASTERY_MAX);
    expect(CHECKPOINT_QUESTIONS).toBeGreaterThanOrEqual(2);
    expect(CHECKPOINT_QUESTIONS).toBeLessThanOrEqual(3);
  });
});

describe("solvesElsewhere", () => {
  it("counts solves since the camp was last practised", () => {
    const progress = progressOf(30, { 1: { earned: 100, touchedAtSolve: 12 } });
    expect(solvesElsewhere(progress, 1)).toBe(18);
  });

  it("is zero for a camp practised on the latest solve", () => {
    const progress = progressOf(30, { 1: { earned: 100, touchedAtSolve: 30 } });
    expect(solvesElsewhere(progress, 1)).toBe(0);
  });

  it("never goes negative, even if a counter somehow ran ahead", () => {
    const progress = progressOf(5, { 1: { earned: 100, touchedAtSolve: 99 } });
    expect(solvesElsewhere(progress, 1)).toBe(0);
  });
});

describe("dimmedMastery", () => {
  it("leaves an untouched-but-fresh camp alone", () => {
    expect(dimmedMastery(100, 0)).toBe(100);
    expect(dimmedMastery(100, DECAY_GRACE_SOLVES)).toBe(100);
  });

  it("starts dimming only after the grace period", () => {
    expect(dimmedMastery(100, DECAY_GRACE_SOLVES + 1)).toBe(100 - DECAY_PER_SOLVE);
    expect(dimmedMastery(100, DECAY_GRACE_SOLVES + 2)).toBe(100 - DECAY_PER_SOLVE * 2);
  });

  it("never dims below the floor, however stale", () => {
    expect(dimmedMastery(100, 10_000)).toBe(DECAY_FLOOR);
  });

  it("never dims an empty meter into life", () => {
    expect(dimmedMastery(0, 500)).toBe(0);
  });

  it("never dims a low meter below what was earned", () => {
    // A camp with less than the floor keeps what it has rather than gaining.
    expect(dimmedMastery(20, 500)).toBe(20);
  });

  it("is monotonic in staleness and never leaves the meter", () => {
    for (const earned of [0, 7, 20, 40, 73, 100]) {
      let previous = Number.POSITIVE_INFINITY;
      for (let stale = 0; stale < 80; stale += 1) {
        const shown = dimmedMastery(earned, stale);
        expect(shown).toBeLessThanOrEqual(previous);
        expect(shown).toBeGreaterThanOrEqual(0);
        expect(shown).toBeLessThanOrEqual(Math.max(earned, 0));
        previous = shown;
      }
    }
  });
});

describe("masteryView", () => {
  it("reports a fresh mastered camp as undimmed and not needing review", () => {
    const view = masteryView(progressOf(10, { 1: { earned: 100, touchedAtSolve: 10 } }), 1);
    expect(view).toMatchObject({ earned: 100, shown: 100, dimmed: 0, isDimmed: false, needsReview: false });
  });

  it("reports the dimmed reading, the gap and the staleness", () => {
    const stale = DECAY_GRACE_SOLVES + 3;
    const view = masteryView(progressOf(stale, { 1: { earned: 100, touchedAtSolve: 0 } }), 1);
    expect(view.stale).toBe(stale);
    expect(view.shown).toBe(100 - DECAY_PER_SOLVE * 3);
    expect(view.dimmed).toBe(DECAY_PER_SOLVE * 3);
    expect(view.isDimmed).toBe(true);
  });

  /** Overdue solves before the meter reads below the threshold. */
  const TO_GATE = Math.floor((MASTERY_MAX - CHECKPOINT_THRESHOLD) / DECAY_PER_SOLVE) + 1;

  it("asks for a review only once a mastered camp has dimmed past the threshold", () => {
    const justAbove = masteryView(
      progressOf(DECAY_GRACE_SOLVES + TO_GATE - 1, { 1: { earned: 100, touchedAtSolve: 0 } }),
      1,
    );
    expect(justAbove.shown).toBeGreaterThanOrEqual(CHECKPOINT_THRESHOLD);
    expect(justAbove.needsReview).toBe(false);

    const past = masteryView(
      progressOf(DECAY_GRACE_SOLVES + TO_GATE, { 1: { earned: 100, touchedAtSolve: 0 } }),
      1,
    );
    expect(past.shown).toBeLessThan(CHECKPOINT_THRESHOLD);
    expect(past.needsReview).toBe(true);
  });

  it("never asks for a review of a camp that was never mastered", () => {
    const view = masteryView(
      progressOf(500, { 1: { earned: UNLOCK_MASTERY - 1, touchedAtSolve: 0 } }),
      1,
    );
    expect(view.needsReview).toBe(false);
  });

  it("reads an empty record as an empty meter everywhere", () => {
    for (const camp of CAMP_NUMBERS) {
      expect(masteryView(NO_PROGRESS, camp)).toMatchObject({ earned: 0, shown: 0, needsReview: false });
    }
  });
});

describe("campNeedingReview", () => {
  const veryStale = { earned: 100, touchedAtSolve: 0 };

  it("never gates a first ascent: climbing straight to the summit leaves camp 1 bright", () => {
    // Eight first-try solves master a camp; three camps is 24 solves.
    const perCamp = Math.ceil(MASTERY_MAX / masteryGain(0));
    const straight = progressOf(perCamp * 3, {
      1: { earned: MASTERY_MAX, touchedAtSolve: perCamp },
      2: { earned: MASTERY_MAX, touchedAtSolve: perCamp * 2 },
      3: { earned: MASTERY_MAX, touchedAtSolve: perCamp * 3 },
    });
    expect(campNeedingReview(straight, 4)).toBeNull();
    expect(masteryView(straight, 1).isDimmed).toBe(false);

    // Even an ascent made entirely of after-a-wobble solves gets there ungated.
    const wobbly = Math.ceil(MASTERY_MAX / masteryGain(1));
    const slow = progressOf(wobbly * 3, {
      1: { earned: MASTERY_MAX, touchedAtSolve: wobbly },
      2: { earned: MASTERY_MAX, touchedAtSolve: wobbly * 2 },
      3: { earned: MASTERY_MAX, touchedAtSolve: wobbly * 3 },
    });
    expect(campNeedingReview(slow, 4)).toBeNull();
  });

  it("does gate a child who settles in at the summit for long enough", () => {
    const perCamp = Math.ceil(MASTERY_MAX / masteryGain(0));
    const lingered = progressOf(perCamp * 3 + DECAY_GRACE_SOLVES, {
      1: { earned: MASTERY_MAX, touchedAtSolve: perCamp },
      2: { earned: MASTERY_MAX, touchedAtSolve: perCamp * 2 },
      3: { earned: MASTERY_MAX, touchedAtSolve: perCamp * 3 },
    });
    expect(campNeedingReview(lingered, 4)).toBe(1);
  });

  it("finds nothing when every camp below is fresh", () => {
    const progress = progressOf(10, {
      1: { earned: 100, touchedAtSolve: 10 },
      2: { earned: 100, touchedAtSolve: 10 },
    });
    expect(campNeedingReview(progress, 3)).toBeNull();
  });

  it("never gates the trailhead, since that is where a dimmed climber practises", () => {
    expect(campNeedingReview(progressOf(500, { 1: veryStale }), 1)).toBeNull();
  });

  it("sends the child to the earliest stale camp, not the nearest", () => {
    const progress = progressOf(500, { 1: veryStale, 2: veryStale, 3: veryStale });
    expect(campNeedingReview(progress, 4)).toBe(1);
  });

  it("looks only below the camp being climbed", () => {
    // Camp 3 is stale, but climbing camp 2 does not depend on camp 3.
    const progress = progressOf(500, {
      1: { earned: 100, touchedAtSolve: 500 },
      3: veryStale,
    });
    expect(campNeedingReview(progress, 2)).toBeNull();
  });

  it("returns a camp strictly below the one being climbed, for every combination", () => {
    const progress = progressOf(500, { 1: veryStale, 2: veryStale, 3: veryStale });
    for (const camp of CAMP_NUMBERS) {
      const review = campNeedingReview(progress, camp);
      if (review !== null) expect(review).toBeLessThan(camp);
    }
  });
});
