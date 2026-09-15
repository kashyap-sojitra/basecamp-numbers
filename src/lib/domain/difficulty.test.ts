import { describe, expect, it } from "vitest";
import {
  DIFFICULTY_LEVELS,
  STARTING_DIFFICULTY,
  difficultyMove,
  levelBand,
  nextDifficulty,
  quickThresholdMs,
  type DifficultyLevel,
} from "./difficulty";

const quick = (level: DifficultyLevel) => quickThresholdMs(level) - 1;
const slow = (level: DifficultyLevel) => quickThresholdMs(level) * 3;
const middling = (level: DifficultyLevel) => quickThresholdMs(level) + 1;

describe("the ladder", () => {
  it("runs 1 to 5 and starts just below the middle", () => {
    expect(DIFFICULTY_LEVELS).toEqual([1, 2, 3, 4, 5]);
    expect(DIFFICULTY_LEVELS).toContain(STARTING_DIFFICULTY);
    expect(STARTING_DIFFICULTY).toBeLessThan(3);
  });

  it("gives harder levels more thinking time", () => {
    for (let i = 1; i < DIFFICULTY_LEVELS.length; i += 1) {
      const lower = DIFFICULTY_LEVELS[i - 1];
      const higher = DIFFICULTY_LEVELS[i];
      if (lower === undefined || higher === undefined) throw new Error("bad ladder");
      expect(quickThresholdMs(higher)).toBeGreaterThan(quickThresholdMs(lower));
    }
  });
});

describe("difficultyMove", () => {
  it("eases off after a wrong answer, however fast it came", () => {
    for (const level of DIFFICULTY_LEVELS) {
      expect(difficultyMove(level, { correct: false, elapsedMs: 1 })).toBe("down");
      expect(difficultyMove(level, { correct: false, elapsedMs: 999_999 })).toBe("down");
    }
  });

  it("steps up on a quick correct answer", () => {
    for (const level of DIFFICULTY_LEVELS) {
      expect(difficultyMove(level, { correct: true, elapsedMs: quick(level) })).toBe("up");
      // The threshold itself still counts as quick.
      expect(
        difficultyMove(level, { correct: true, elapsedMs: quickThresholdMs(level) }),
      ).toBe("up");
    }
  });

  it("steps down when the answer was right but a struggle", () => {
    for (const level of DIFFICULTY_LEVELS) {
      expect(difficultyMove(level, { correct: true, elapsedMs: slow(level) })).toBe("down");
    }
  });

  it("holds when the answer was right and neither quick nor slow", () => {
    for (const level of DIFFICULTY_LEVELS) {
      expect(difficultyMove(level, { correct: true, elapsedMs: middling(level) })).toBe("hold");
    }
  });

  it("returns only the three moves it declares, for a wide sweep of answers", () => {
    const seen = new Set<string>();
    for (const level of DIFFICULTY_LEVELS) {
      for (let ms = 0; ms < 60_000; ms += 250) {
        for (const correct of [true, false]) {
          seen.add(difficultyMove(level, { correct, elapsedMs: ms }));
        }
      }
    }
    expect(seen).toEqual(new Set(["up", "hold", "down"]));
  });
});

describe("nextDifficulty", () => {
  it("clamps at the top of the ladder", () => {
    expect(nextDifficulty(5, { correct: true, elapsedMs: 1 })).toBe(5);
  });

  it("clamps at the bottom of the ladder", () => {
    expect(nextDifficulty(1, { correct: false, elapsedMs: 1 })).toBe(1);
  });

  it("moves exactly one rung, never more", () => {
    for (const level of DIFFICULTY_LEVELS) {
      for (const outcome of [
        { correct: true, elapsedMs: quick(level) },
        { correct: true, elapsedMs: middling(level) },
        { correct: true, elapsedMs: slow(level) },
        { correct: false, elapsedMs: 100 },
      ]) {
        expect(Math.abs(nextDifficulty(level, outcome) - level)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("always lands on a real level", () => {
    for (const level of DIFFICULTY_LEVELS) {
      for (let ms = 0; ms < 40_000; ms += 500) {
        expect(DIFFICULTY_LEVELS).toContain(nextDifficulty(level, { correct: true, elapsedMs: ms }));
      }
    }
  });

  it("climbs to the top and settles there when every answer is quick", () => {
    let level: DifficultyLevel = 1;
    for (let i = 0; i < 20; i += 1) {
      level = nextDifficulty(level, { correct: true, elapsedMs: 1 });
    }
    expect(level).toBe(5);
  });

  it("falls to the bottom and settles there when every answer is wrong", () => {
    let level: DifficultyLevel = 5;
    for (let i = 0; i < 20; i += 1) {
      level = nextDifficulty(level, { correct: false, elapsedMs: 1 });
    }
    expect(level).toBe(1);
  });
});

describe("levelBand", () => {
  it("stays inside the range it is given, at every level", () => {
    for (const level of DIFFICULTY_LEVELS) {
      for (const [min, max] of [[1, 9], [2, 19], [4, 20], [0, 100], [5, 6]]) {
        if (min === undefined || max === undefined) throw new Error("bad case");
        const band = levelBand(min, max, level);
        expect(band.lo).toBeGreaterThanOrEqual(min);
        expect(band.hi).toBeLessThanOrEqual(max);
        expect(band.lo).toBeLessThanOrEqual(band.hi);
      }
    }
  });

  it("never moves the band downward as the level rises", () => {
    for (let i = 1; i < DIFFICULTY_LEVELS.length; i += 1) {
      const lower = DIFFICULTY_LEVELS[i - 1];
      const higher = DIFFICULTY_LEVELS[i];
      if (lower === undefined || higher === undefined) throw new Error("bad ladder");
      const a = levelBand(1, 20, lower);
      const b = levelBand(1, 20, higher);
      expect(b.lo).toBeGreaterThanOrEqual(a.lo);
      expect(b.hi).toBeGreaterThanOrEqual(a.hi);
    }
  });

  it("reaches the top of the range at the top level", () => {
    expect(levelBand(1, 20, 5).hi).toBe(20);
  });

  it("collapses to a point when the range is empty or inverted", () => {
    expect(levelBand(7, 7, 3)).toEqual({ lo: 7, hi: 7 });
    expect(levelBand(9, 2, 3)).toEqual({ lo: 9, hi: 9 });
  });
});
