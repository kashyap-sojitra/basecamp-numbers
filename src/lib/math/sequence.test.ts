import { describe, expect, it } from "vitest";
import { LOOKBACK, buildSequence } from "./sequence";
import { ladderStart, LADDER_CYCLE } from "./sequence";
import { generateJumpProblem } from "./numberLineProblems";
import { generateGroupingTask } from "./groupingTasks";
import { DIFFICULTY_LEVELS } from "@/lib/domain/difficulty";

/** A generator over a space of exactly `size` values, salted like the real ones. */
function cyclic(size: number) {
  return (index: number, salt: number) => (index + salt * 7) % size;
}

const same = (a: number, b: number) => a === b;

describe("buildSequence", () => {
  it("builds the number of entries asked for", () => {
    expect(buildSequence(0, cyclic(10), same)).toEqual([]);
    expect(buildSequence(1, cyclic(10), same)).toHaveLength(1);
    expect(buildSequence(50, cyclic(10), same)).toHaveLength(50);
  });

  it("is deterministic", () => {
    expect(buildSequence(30, cyclic(9), same)).toEqual(buildSequence(30, cyclic(9), same));
  });

  it("keeps the whole lookback window distinct when the space is roomy", () => {
    const sequence = buildSequence(200, cyclic(50), same);
    for (let i = 1; i < sequence.length; i += 1) {
      const value = sequence[i];
      for (const earlier of sequence.slice(Math.max(0, i - LOOKBACK), i)) {
        expect(earlier).not.toBe(value);
      }
    }
  });

  it("never repeats back to back, even when the space is smaller than the window", () => {
    for (const size of [2, 3, 4]) {
      const sequence = buildSequence(120, cyclic(size), same);
      for (let i = 1; i < sequence.length; i += 1) {
        expect(sequence[i]).not.toBe(sequence[i - 1]);
      }
    }
  });

  it("still terminates when only one value exists at all", () => {
    const sequence = buildSequence(10, cyclic(1), same);
    expect(sequence).toEqual(Array.from({ length: 10 }, () => 0));
  });

  it("reaches every value in the space", () => {
    for (const size of [2, 3, 5, 12]) {
      const sequence = buildSequence(300, cyclic(size), same);
      expect(new Set(sequence).size).toBe(size);
    }
  });

  it("passes the index through unchanged, so problem N is problem N", () => {
    const seen: number[] = [];
    buildSequence(6, (index, salt) => {
      if (salt === 0) seen.push(index);
      return index;
    }, same);
    expect(seen).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("ladderStart: a return visit is not a replay", () => {
  it("starts at the beginning for a child who has never solved anything", () => {
    expect(ladderStart(0)).toBe(0);
  });

  it("moves the opening on as the child solves, so no two sittings open alike", () => {
    // A sitting of five problems leaves the next one starting five rungs up.
    const openings = [0, 5, 11, 18, 26].map(ladderStart);
    expect(new Set(openings).size).toBe(openings.length);
  });

  it("stays inside the cycle however much a child has solved", () => {
    for (const solves of [0, 1, 59, 60, 61, 1_000, 99_999]) {
      const start = ladderStart(solves);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(start).toBeLessThan(LADDER_CYCLE);
    }
  });

  it("survives nonsense rather than generating a problem at index NaN", () => {
    expect(ladderStart(Number.NaN)).toBe(0);
    expect(ladderStart(-5)).toBe(0);
    expect(ladderStart(2.7)).toBe(2);
  });

  it("gives a real, different opening problem for each of a child's first sittings", () => {
    // The bug this guards: every K-1 climber opened camp 1 with `5 + 2`, on
    // every visit, forever.
    const openings = [0, 6, 13, 21].map((solves) =>
      generateJumpProblem("within-place", "k-1", 2, ladderStart(solves)),
    );
    const shapes = openings.map((p) => `${String(p.start)}${p.operation}${String(p.change)}`);
    expect(new Set(shapes).size).toBe(shapes.length);
  });
});

describe("a level change must not repeat the problem just seen", () => {
  /*
   * The ladder keeps a problem distinct from the others *at its own level*, and
   * difficulty changes between problems — so a level change used to slip the
   * same task through twice running. `generateGroupingTask`/`generateJumpProblem`
   * take the task just finished for exactly this reason.
   */
  it("never hands back the same array twice, at any level pairing", () => {
    for (const band of ["k-1", "2-3", "4-5"] as const) {
      for (const from of DIFFICULTY_LEVELS) {
        for (const to of DIFFICULTY_LEVELS) {
          for (let index = 0; index < 8; index += 1) {
            const previous = generateGroupingTask("array", band, from, index);
            const next = generateGroupingTask("array", band, to, index + 1, previous);
            if (previous.kind !== "array" || next.kind !== "array") continue;
            expect(
              `${String(next.rows)}x${String(next.cols)}`,
              `${band} L${String(from)}->L${String(to)} at ${String(index)}`,
            ).not.toBe(`${String(previous.rows)}x${String(previous.cols)}`);
          }
        }
      }
    }
  });

  it("never hands back the same jump twice, at any level pairing", () => {
    for (const band of ["k-1", "2-3", "4-5"] as const) {
      for (const skill of ["within-place", "cross-place"] as const) {
        for (const from of DIFFICULTY_LEVELS) {
          for (const to of DIFFICULTY_LEVELS) {
            const previous = generateJumpProblem(skill, band, from, 3);
            const next = generateJumpProblem(skill, band, to, 4, previous);
            const shape = (p: typeof previous) => `${String(p.start)}${p.operation}${String(p.change)}`;
            expect(shape(next), `${band} ${skill} L${String(from)}->L${String(to)}`).not.toBe(shape(previous));
          }
        }
      }
    }
  });

  it("still ignores `avoid` when it is not given, so the ladder is unchanged", () => {
    expect(generateGroupingTask("array", "2-3", 3, 5)).toEqual(
      generateGroupingTask("array", "2-3", 3, 5, null),
    );
  });
});
