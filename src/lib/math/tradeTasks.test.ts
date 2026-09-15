import { describe, expect, it } from "vitest";
import type { GradeBand } from "@/lib/domain/onboarding";
import { DIFFICULTY_LEVELS } from "@/lib/domain/difficulty";
import {
  PLACE_UNITS,
  TRADE_AT,
  isTidy,
  placeCountsValue,
  tradeUp,
} from "@/lib/domain/grouping";
import { generateTradeTask, needsTrading } from "./tradeTasks";

const BANDS: readonly GradeBand[] = ["k-1", "2-3", "4-5"];
const SWEEP = 60;

/** Every band x level x index a child could realistically meet. */
function everyTask() {
  const tasks = [];
  for (const band of BANDS) {
    for (const level of DIFFICULTY_LEVELS) {
      for (let index = 0; index < SWEEP; index += 1) {
        tasks.push({ band, level, index, task: generateTradeTask(band, level, index) });
      }
    }
  }
  return tasks;
}

describe("generateTradeTask: the mat always shows the number", () => {
  it("starts worth exactly the target, so trading never changes the value", () => {
    for (const { task } of everyTask()) {
      expect(placeCountsValue(task.start)).toBe(task.target);
    }
  });

  it("always needs at least one trade — an already-tidy mat is not a puzzle", () => {
    for (const { task } of everyTask()) {
      expect(isTidy(task.start, task.units)).toBe(false);
      expect(needsTrading(task)).toBe(true);
    }
  });

  it("never offers a place the task has no denomination for", () => {
    for (const { task } of everyTask()) {
      for (const unit of PLACE_UNITS) {
        if (!task.units.includes(unit)) expect(task.start[unit]).toBe(0);
      }
    }
  });

  it("is deterministic: the same slot always gives the same task", () => {
    for (const { band, level, index, task } of everyTask().slice(0, 40)) {
      const again = generateTradeTask(band, level, index);
      expect(again).toEqual(task);
    }
  });
});

describe("generateTradeTask: every task can actually be finished", () => {
  it("reaches a tidy mat by trading, and the value is the same at the end", () => {
    for (const { task } of everyTask()) {
      let counts = task.start;
      // Trade the lowest overfull place until nothing is overfull. Bounded so a
      // task that could not be finished fails the test rather than hanging.
      for (let step = 0; step < 200 && !isTidy(counts, task.units); step += 1) {
        const overfull = [...task.units]
          .reverse()
          .find((unit) => unit !== task.units[0] && counts[unit] >= TRADE_AT);
        expect(overfull).toBeDefined();
        const next = overfull === undefined ? null : tradeUp(counts, overfull);
        expect(next).not.toBeNull();
        if (next === null) break;
        counts = next;
      }
      expect(isTidy(counts, task.units)).toBe(true);
      expect(placeCountsValue(counts)).toBe(task.target);
    }
  });
});

describe("generateTradeTask: a level change must not repeat the task just seen", () => {
  it("never hands back the same task twice, at any level pairing", () => {
    for (const band of BANDS) {
      for (const from of DIFFICULTY_LEVELS) {
        for (const to of DIFFICULTY_LEVELS) {
          for (let index = 0; index < 12; index += 1) {
            const first = generateTradeTask(band, from, index);
            const second = generateTradeTask(band, to, index + 1, first);
            const same =
              second.target === first.target &&
              PLACE_UNITS.every((unit) => second.start[unit] === first.start[unit]);
            expect(same).toBe(false);
          }
        }
      }
    }
  });

  it("ignores `avoid` when it is not given, so the ladder is unchanged", () => {
    const plain = generateTradeTask("2-3", 3, 5);
    expect(generateTradeTask("2-3", 3, 5, null)).toEqual(plain);
  });
});

describe("tradeUp", () => {
  it("swaps ten of a place for one of the place above, keeping the value", () => {
    const counts = { 1000: 0, 100: 0, 10: 0, 1: 14 };
    const traded = tradeUp(counts, 1);
    expect(traded).toEqual({ 1000: 0, 100: 0, 10: 1, 1: 4 });
    expect(placeCountsValue(traded ?? counts)).toBe(14);
  });

  it("refuses a place without ten in it, and the top place", () => {
    expect(tradeUp({ 1000: 0, 100: 0, 10: 0, 1: 9 }, 1)).toBeNull();
    expect(tradeUp({ 1000: 2, 100: 0, 10: 0, 1: 0 }, 1000)).toBeNull();
  });
});
