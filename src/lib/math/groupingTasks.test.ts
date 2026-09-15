import { describe, expect, it } from "vitest";
import {
  expectedBlocks,
  generateGroupingSequence,
  generateGroupingTask,
} from "./groupingTasks";
import { GROUPING_BAND_RANGES, PLACE_UNITS, placeCountsValue } from "@/lib/domain/grouping";
import { evaluateWorkspace } from "@/lib/domain/groupingSession";
import { DIFFICULTY_LEVELS, levelBand, type DifficultyLevel } from "@/lib/domain/difficulty";
import type { GroupingFocus } from "@/lib/domain/camp";
import type { GroupingTask } from "@/lib/domain/grouping";
import type { GradeBand } from "@/lib/domain/onboarding";

const BANDS: readonly GradeBand[] = ["k-1", "2-3", "4-5"];
const FOCUSES: readonly GroupingFocus[] = ["array", "place-value"];
const SWEEP = 150;

/** How many recent tasks the generator keeps a new one distinct from. */
const LOOKBACK = 3;

/** Identifies a task by what a child would notice, so repeats are comparable. */
function signature(task: GroupingTask): string {
  return task.kind === "array"
    ? `${String(task.rows)}x${String(task.cols)}`
    : String(task.target);
}

function distinctSpace(sequence: readonly GroupingTask[]): number {
  return new Set(sequence.map(signature)).size;
}

/** Every band × level, which with the two focuses is the generator's surface. */
function combinations() {
  const out: { band: GradeBand; level: DifficultyLevel }[] = [];
  for (const band of BANDS) for (const level of DIFFICULTY_LEVELS) out.push({ band, level });
  return out;
}

describe("array tasks", () => {
  it("stay inside the band's row and column bounds", () => {
    for (const { band, level } of combinations()) {
      const { array } = GROUPING_BAND_RANGES[band];
      for (let index = 0; index < SWEEP; index += 1) {
        const task = generateGroupingTask("array", band, level, index);
        if (task.kind !== "array") throw new Error("expected an array task");
        expect(task.rows).toBeGreaterThanOrEqual(array.minRows);
        expect(task.rows).toBeLessThanOrEqual(array.maxRows);
        expect(task.cols).toBeGreaterThanOrEqual(array.minCols);
        expect(task.cols).toBeLessThanOrEqual(array.maxCols);
      }
    }
  });

  it("always offer the right strip among the choices", () => {
    for (const { band, level } of combinations()) {
      for (let index = 0; index < SWEEP; index += 1) {
        const task = generateGroupingTask("array", band, level, index);
        if (task.kind !== "array") throw new Error("expected an array task");
        expect(task.stripChoices).toContain(task.cols);
      }
    }
  });

  it("never offer a strip too long for the band's frame, or shorter than two", () => {
    for (const { band, level } of combinations()) {
      const { array } = GROUPING_BAND_RANGES[band];
      for (let index = 0; index < SWEEP; index += 1) {
        const task = generateGroupingTask("array", band, level, index);
        if (task.kind !== "array") throw new Error("expected an array task");
        for (const choice of task.stripChoices) {
          expect(choice).toBeGreaterThanOrEqual(2);
          expect(choice).toBeLessThanOrEqual(array.maxCols);
        }
      }
    }
  });

  it("offer a manageable, duplicate-free set of choices", () => {
    for (const { band, level } of combinations()) {
      for (let index = 0; index < 60; index += 1) {
        const task = generateGroupingTask("array", band, level, index);
        if (task.kind !== "array") throw new Error("expected an array task");
        expect(new Set(task.stripChoices).size).toBe(task.stripChoices.length);
        expect(task.stripChoices.length).toBeLessThanOrEqual(5);
        expect(task.stripChoices.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("are solvable exactly as the evaluator expects", () => {
    for (const { band, level } of combinations()) {
      for (let index = 0; index < 60; index += 1) {
        const task = generateGroupingTask("array", band, level, index);
        if (task.kind !== "array") throw new Error("expected an array task");
        const strips = Array.from({ length: task.rows }, () => task.cols);
        expect(evaluateWorkspace(task, { kind: "array", strips })).toEqual({
          kind: "solved",
          commuted: false,
        });
      }
    }
  });
});

describe("place-value tasks", () => {
  it("offer denominations largest first, all real units", () => {
    for (const { band, level } of combinations()) {
      for (let index = 0; index < SWEEP; index += 1) {
        const task = generateGroupingTask("place-value", band, level, index);
        if (task.kind !== "place-value") throw new Error("expected a place-value task");
        expect(task.unitChoices.length).toBeGreaterThan(0);
        for (const unit of task.unitChoices) expect(PLACE_UNITS).toContain(unit);
        const sorted = [...task.unitChoices].sort((a, b) => b - a);
        expect(task.unitChoices).toEqual(sorted);
        expect(task.unitChoices.at(-1)).toBe(1);
      }
    }
  });

  it("never exceed the band's top denomination", () => {
    for (const { band, level } of combinations()) {
      const { placeValue } = GROUPING_BAND_RANGES[band];
      for (let index = 0; index < SWEEP; index += 1) {
        const task = generateGroupingTask("place-value", band, level, index);
        if (task.kind !== "place-value") throw new Error("expected a place-value task");
        expect(task.unitChoices[0]).toBeLessThanOrEqual(placeValue.topUnit);
        expect(task.unitChoices[0]).toBeGreaterThanOrEqual(placeValue.minTopUnit);
      }
    }
  });

  it("set a target the offered denominations can actually build", () => {
    for (const { band, level } of combinations()) {
      for (let index = 0; index < SWEEP; index += 1) {
        const task = generateGroupingTask("place-value", band, level, index);
        if (task.kind !== "place-value") throw new Error("expected a place-value task");
        const topUnit = task.unitChoices[0];
        const built = task.unitChoices.reduce(
          (sum, unit) => sum + unit * expectedBlocks(task.target, unit, topUnit),
          0,
        );
        expect(built).toBe(task.target);
      }
    }
  });

  it("stay inside the band's block budget, so no task is a dragging chore", () => {
    for (const { band, level } of combinations()) {
      const { placeValue } = GROUPING_BAND_RANGES[band];
      for (let index = 0; index < SWEEP; index += 1) {
        const task = generateGroupingTask("place-value", band, level, index);
        if (task.kind !== "place-value") throw new Error("expected a place-value task");
        const topUnit = task.unitChoices[0];
        const blocks = task.unitChoices.reduce(
          (sum, unit) => sum + expectedBlocks(task.target, unit, topUnit),
          0,
        );
        expect(blocks).toBeGreaterThan(0);
        expect(blocks).toBeLessThanOrEqual(placeValue.maxBlocks);
      }
    }
  });

  it("respect the band's floor, so bands do not repeat each other's numbers", () => {
    for (const { band, level } of combinations()) {
      const { placeValue } = GROUPING_BAND_RANGES[band];
      for (let index = 0; index < SWEEP; index += 1) {
        const task = generateGroupingTask("place-value", band, level, index);
        if (task.kind !== "place-value") throw new Error("expected a place-value task");
        const topUnit = task.unitChoices[0];
        expect(Math.floor(task.target / topUnit)).toBeGreaterThanOrEqual(placeValue.minTopDigit);
      }
    }
  });

  it("gives K-1 a teen: exactly one ten and some ones", () => {
    for (const level of DIFFICULTY_LEVELS) {
      for (let index = 0; index < SWEEP; index += 1) {
        const task = generateGroupingTask("place-value", "k-1", level, index);
        if (task.kind !== "place-value") throw new Error("expected a place-value task");
        expect(task.target).toBeGreaterThanOrEqual(11);
        expect(task.target).toBeLessThanOrEqual(19);
        expect(task.unitChoices).toEqual([10, 1]);
      }
    }
  });

  it("moves 2-3 past the teens, into two-digit tens and ones", () => {
    for (const level of DIFFICULTY_LEVELS) {
      for (let index = 0; index < SWEEP; index += 1) {
        const task = generateGroupingTask("place-value", "2-3", level, index);
        if (task.kind !== "place-value") throw new Error("expected a place-value task");
        expect(task.target).toBeGreaterThanOrEqual(20);
        expect(task.target).toBeLessThanOrEqual(99);
      }
    }
  });

  it("sometimes leaves the thousands mat out of play in 4-5", () => {
    const tops = new Set<number>();
    for (const level of DIFFICULTY_LEVELS) {
      for (let index = 0; index < SWEEP; index += 1) {
        const task = generateGroupingTask("place-value", "4-5", level, index);
        if (task.kind !== "place-value") throw new Error("expected a place-value task");
        tops.add(task.unitChoices[0]);
      }
    }
    expect(tops).toEqual(new Set([1000, 100]));
  });

  it("are solvable exactly as the evaluator expects", () => {
    for (const { band, level } of combinations()) {
      for (let index = 0; index < 60; index += 1) {
        const task = generateGroupingTask("place-value", band, level, index);
        if (task.kind !== "place-value") throw new Error("expected a place-value task");
        const topUnit = task.unitChoices[0];
        const counts = { 1000: 0, 100: 0, 10: 0, 1: 0 };
        for (const unit of task.unitChoices) {
          counts[unit] = expectedBlocks(task.target, unit, topUnit);
        }
        expect(placeCountsValue(counts)).toBe(task.target);
        expect(evaluateWorkspace(task, { kind: "place-value", counts })).toEqual({
          kind: "solved",
          commuted: false,
        });
      }
    }
  });
});

describe("determinism and variety", () => {
  it("gives the same task for the same four inputs", () => {
    for (const focus of FOCUSES) {
      for (const { band, level } of combinations()) {
        for (const index of [0, 3, 19]) {
          expect(generateGroupingTask(focus, band, level, index)).toEqual(
            generateGroupingTask(focus, band, level, index),
          );
        }
      }
    }
  });

  it("carries the index it was asked for", () => {
    for (const focus of FOCUSES) {
      for (let index = 0; index < 20; index += 1) {
        expect(generateGroupingTask(focus, "2-3", 3, index).index).toBe(index);
      }
    }
  });

  it("does not repeat a task within the lookback window, where the space allows", () => {
    for (const focus of FOCUSES) {
      for (const { band, level } of combinations()) {
        const sequence = generateGroupingSequence(focus, band, level, 100);
        const space = distinctSpace(sequence);
        // With only LOOKBACK + 1 distinct tasks available, avoiding a repeat
        // in a 3-back window needs a perfect cycle, which random salting
        // cannot promise — and the generator deliberately gives up rather
        // than looping forever. Anywhere roomier, repeats must not happen.
        if (space <= LOOKBACK + 1) continue;
        for (let i = 1; i < sequence.length; i += 1) {
          const task = sequence[i];
          if (task === undefined) throw new Error("bad sequence");
          for (const earlier of sequence.slice(Math.max(0, i - LOOKBACK), i)) {
            expect(signature(earlier)).not.toBe(signature(task));
          }
        }
      }
    }
  });

  it("never sets the same task twice in a row", () => {
    for (const focus of FOCUSES) {
      for (const { band, level } of combinations()) {
        const sequence = generateGroupingSequence(focus, band, level, 100);
        for (let i = 1; i < sequence.length; i += 1) {
          const task = sequence[i];
          const previous = sequence[i - 1];
          if (task === undefined || previous === undefined) throw new Error("bad sequence");
          expect(signature(previous)).not.toBe(signature(task));
        }
      }
    }
  });

  it("uses the whole space its band and level allow", () => {
    for (const { band, level } of combinations()) {
      const { array } = GROUPING_BAND_RANGES[band];
      const rows = levelBand(array.minRows, array.maxRows, level);
      const cols = levelBand(array.minCols, array.maxCols, level);
      const available = (rows.hi - rows.lo + 1) * (cols.hi - cols.lo + 1);
      const sequence = generateGroupingSequence("array", band, level, 80);
      // Every array the level permits actually turns up, so nothing in the
      // range is unreachable.
      expect(distinctSpace(sequence)).toBe(available);
    }
  });

  it("offers at least three different tasks at every band and level", () => {
    for (const focus of FOCUSES) {
      for (const { band, level } of combinations()) {
        const sequence = generateGroupingSequence(focus, band, level, 60);
        expect(distinctSpace(sequence)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("pins the tightest space in the app, so retuning it is a visible change", () => {
    // K-1 place value at level 1 offers exactly three teens: 11, 12 and 13.
    // That is the narrowest any camp gets, and it is deliberate — a child
    // answering correctly moves up a level immediately. If this number
    // changes, the tuning changed with it.
    const targets = new Set(
      generateGroupingSequence("place-value", "k-1", 1, 60).map((task) =>
        task.kind === "place-value" ? task.target : 0,
      ),
    );
    expect([...targets].sort((a, b) => a - b)).toEqual([11, 12, 13]);
  });

  it("agrees with the sequence it comes from", () => {
    const sequence = generateGroupingSequence("place-value", "4-5", 3, 20);
    for (let index = 0; index < sequence.length; index += 1) {
      expect(generateGroupingTask("place-value", "4-5", 3, index)).toEqual(sequence[index]);
    }
  });

  it("returns an empty sequence for a count of zero", () => {
    expect(generateGroupingSequence("array", "k-1", 1, 0)).toEqual([]);
  });

  it("makes higher levels set bigger arrays, on average", () => {
    for (const band of BANDS) {
      const mean = (level: DifficultyLevel) => {
        const sequence = generateGroupingSequence("array", band, level, 80);
        return (
          sequence.reduce(
            (sum, task) => sum + (task.kind === "array" ? task.rows * task.cols : 0),
            0,
          ) / sequence.length
        );
      };
      expect(mean(5)).toBeGreaterThan(mean(1));
    }
  });
});

describe("expectedBlocks", () => {
  it("reads the digit out of each place below the top", () => {
    expect(expectedBlocks(342, 100, 1000)).toBe(3);
    expect(expectedBlocks(342, 10, 1000)).toBe(4);
    expect(expectedBlocks(342, 1, 1000)).toBe(2);
  });

  it("sweeps up everything at or above the top denomination", () => {
    // With tens as the top place, 34 is three tens, not "3 tens of a hundred".
    expect(expectedBlocks(34, 10, 10)).toBe(3);
    // A target beyond one digit at the top place still counts in full.
    expect(expectedBlocks(120, 10, 10)).toBe(12);
  });

  it("is zero for an empty place", () => {
    expect(expectedBlocks(105, 10, 1000)).toBe(0);
  });
});
