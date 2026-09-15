import { describe, expect, it } from "vitest";
import { diagnoseTrade, valueOf } from "./tradeDiagnosis";
import type { PlaceCounts, PlaceUnit } from "./grouping";
import { generateTradeTask } from "@/lib/math/tradeTasks";
import { DIFFICULTY_LEVELS } from "./difficulty";
import type { GradeBand } from "./onboarding";

const TENS_ONES: readonly PlaceUnit[] = [10, 1];
const ALL: readonly PlaceUnit[] = [1000, 100, 10, 1];

function counts(partial: Partial<Record<PlaceUnit, number>>): PlaceCounts {
  return { 1000: 0, 100: 0, 10: 0, 1: 0, ...partial };
}

describe("diagnoseTrade: the classic slips, told apart from the counts", () => {
  const mat = counts({ 10: 7, 1: 14 }); // 84

  it("names the counts written side by side", () => {
    expect(diagnoseTrade(714, mat, TENS_ONES, 84)).toBe("places-side-by-side");
    expect(diagnoseTrade(21315, counts({ 1000: 2, 100: 13, 10: 1, 1: 5 }), ALL, 3315)).toBe(
      "places-side-by-side",
    );
  });

  it("names a forgotten carry: the ringed ten was read as a digit", () => {
    expect(diagnoseTrade(74, mat, TENS_ONES, 84)).toBe("forgot-to-carry");
    // 2 thousands, 13 hundreds, 1 ten, 15 ones = 3325; without carries 2315.
    expect(diagnoseTrade(2315, counts({ 1000: 2, 100: 13, 10: 1, 1: 15 }), ALL, 3325)).toBe(
      "forgot-to-carry",
    );
  });

  it("names one away", () => {
    expect(diagnoseTrade(85, mat, TENS_ONES, 84)).toBe("off-by-one");
    expect(diagnoseTrade(83, mat, TENS_ONES, 84)).toBe("off-by-one");
  });

  it("names a single place answered on its own", () => {
    expect(diagnoseTrade(70, mat, TENS_ONES, 84)).toBe("one-place-only");
    expect(diagnoseTrade(14, mat, TENS_ONES, 84)).toBe("one-place-only");
    expect(diagnoseTrade(7, mat, TENS_ONES, 84)).toBe("one-place-only");
  });

  it("falls back to a plain miscount", () => {
    expect(diagnoseTrade(48, mat, TENS_ONES, 84)).toBe("miscounted");
    expect(diagnoseTrade(100, mat, TENS_ONES, 84)).toBe("miscounted");
  });

  it("never blames a carry on a mat that has none to carry", () => {
    // A tidy-looking top place: 12 tens and 3 ones is 123; the top carries nothing.
    const top = counts({ 10: 12, 1: 3 });
    expect(diagnoseTrade(123, top, TENS_ONES, 123)).not.toBe("forgot-to-carry");
  });
});

describe("diagnoseTrade across every task the ladder can pose", () => {
  const BANDS: readonly GradeBand[] = ["k-1", "2-3", "4-5"];

  it("the value of the counts is the target, and the side-by-side and no-carry slips are wrong answers", () => {
    for (const band of BANDS) {
      for (const level of DIFFICULTY_LEVELS) {
        for (let index = 0; index < 40; index += 1) {
          const task = generateTradeTask(band, level, index);
          expect(valueOf(task.start, task.units)).toBe(task.target);
          // Every named slip is a specific wrong answer, never the right one.
          for (const wrong of [task.target + 1, task.target - 1]) {
            expect(diagnoseTrade(wrong, task.start, task.units, task.target)).toBe("off-by-one");
          }
        }
      }
    }
  });
});
