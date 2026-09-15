import { describe, expect, it } from "vitest";
import { generateJumpProblem } from "./numberLineProblems";
import { generateGroupingTask } from "./groupingTasks";
import { DIFFICULTY_LEVELS } from "@/lib/domain/difficulty";
import type { GradeBand } from "@/lib/domain/onboarding";

/**
 * What a child actually meets, at every band and every level.
 *
 * This is the executable copy of the difficulty table in CLAUDE.md. The point
 * is that "what to expect at level 3" is answerable without reading the
 * generators, and that the answer cannot drift: retuning a band is a visible
 * change to these numbers rather than something a reviewer has to notice.
 *
 * Tighten a bound when you deliberately retune. Never widen one to make a
 * failing test pass.
 */

const BANDS: readonly GradeBand[] = ["k-1", "2-3", "4-5"];
const SAMPLE = 400;

/** [min, max] of the jump size, per level 1..5. */
const JUMP: Record<GradeBand, readonly [number, number][]> = {
  "k-1": [[1, 3], [2, 5], [4, 6], [5, 8], [7, 9]],
  "2-3": [[3, 7], [6, 11], [9, 13], [12, 16], [15, 19]],
  "4-5": [[6, 9], [8, 12], [11, 15], [14, 18], [17, 20]],
};

/** [min, max] of the array's product, per level. */
const PRODUCT: Record<GradeBand, readonly [number, number][]> = {
  "k-1": [[4, 9], [4, 12], [6, 12], [6, 15], [8, 15]],
  "2-3": [[9, 16], [9, 25], [16, 25], [16, 36], [25, 36]],
  "4-5": [[16, 25], [25, 36], [36, 49], [49, 64], [64, 81]],
};

/** [min, max] of the place-value target, per level. */
const TARGET: Record<GradeBand, readonly [number, number][]> = {
  "k-1": [[11, 13], [12, 15], [14, 16], [15, 18], [17, 19]],
  "2-3": [[20, 52], [30, 63], [40, 74], [50, 85], [60, 95]],
  "4-5": [[100, 440], [200, 540], [300, 651], [1004, 5440], [2000, 5541]],
};

function spread(values: readonly number[]): readonly [number, number] {
  return [Math.min(...values), Math.max(...values)];
}

function jumpsAt(band: GradeBand, level: (typeof DIFFICULTY_LEVELS)[number]): readonly number[] {
  return ["within-place", "cross-place"].flatMap((skill) =>
    Array.from({ length: SAMPLE }, (_, i) =>
      generateJumpProblem(skill === "within-place" ? "within-place" : "cross-place", band, level, i).change,
    ),
  );
}

describe("the difficulty ladder is what the docs say it is", () => {
  it("keeps every band's jump size inside its documented range, level by level", () => {
    for (const band of BANDS) {
      for (const level of DIFFICULTY_LEVELS) {
        const want = JUMP[band][level - 1];
        expect(want, `no documented jump range for ${band} L${String(level)}`).toBeDefined();
        if (want === undefined) continue;
        expect(spread(jumpsAt(band, level)), `${band} L${String(level)} jump size`).toEqual(want);
      }
    }
  });

  it("keeps every band's array product inside its documented range", () => {
    for (const band of BANDS) {
      for (const level of DIFFICULTY_LEVELS) {
        const want = PRODUCT[band][level - 1];
        if (want === undefined) continue;
        const products = Array.from({ length: SAMPLE }, (_, i) => {
          const task = generateGroupingTask("array", band, level, i);
          return task.kind === "array" ? task.rows * task.cols : 0;
        });
        expect(spread(products), `${band} L${String(level)} product`).toEqual(want);
      }
    }
  });

  it("keeps every band's place-value target inside its documented range", () => {
    for (const band of BANDS) {
      for (const level of DIFFICULTY_LEVELS) {
        const want = TARGET[band][level - 1];
        if (want === undefined) continue;
        const targets = Array.from({ length: SAMPLE }, (_, i) => {
          const task = generateGroupingTask("place-value", band, level, i);
          return task.kind === "place-value" ? task.target : 0;
        });
        expect(spread(targets), `${band} L${String(level)} target`).toEqual(want);
      }
    }
  });

  it("never goes backwards: a harder level is never easier than the one below", () => {
    for (const band of BANDS) {
      for (const table of [JUMP[band], PRODUCT[band], TARGET[band]]) {
        for (let i = 1; i < table.length; i += 1) {
          const below = table[i - 1];
          const here = table[i];
          if (below === undefined || here === undefined) continue;
          expect(here[0], `${band} level ${String(i + 1)} floor`).toBeGreaterThanOrEqual(below[0]);
          expect(here[1], `${band} level ${String(i + 1)} ceiling`).toBeGreaterThanOrEqual(below[1]);
        }
      }
    }
  });

  it("never hands an older band the younger band's easiest work", () => {
    // The defect this pins: 2-3's level 1 array was 2x2, exactly K-1's, and
    // its camp 1 drew the same 1-9 jump K-1 did.
    for (const [younger, older] of [["k-1", "2-3"], ["2-3", "4-5"]] as const) {
      for (const table of [JUMP, PRODUCT, TARGET]) {
        const y = table[younger][0];
        const o = table[older][0];
        if (y === undefined || o === undefined) continue;
        expect(o[0], `${older} L1 floor should clear ${younger}'s`).toBeGreaterThan(y[0]);
      }
    }
  });

  it("changes place count at most once per band, so a child gains a digit only once", () => {
    for (const band of BANDS) {
      const digits = DIFFICULTY_LEVELS.map((level) => {
        const task = generateGroupingTask("place-value", band, level, 0);
        return task.kind === "place-value" ? String(task.target).length : 0;
      });
      const jumps = digits.filter((d, i) => i > 0 && d !== digits[i - 1]).length;
      expect(jumps, `${band} changes digit count ${String(jumps)} times`).toBeLessThanOrEqual(1);
    }
  });
});
