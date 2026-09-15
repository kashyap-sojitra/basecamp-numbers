import { describe, expect, it } from "vitest";
import {
  EMPTY_PLACE_COUNTS,
  GROUPING_BAND_RANGES,
  PLACE_LABEL,
  PLACE_UNITS,
  digitAt,
  emptyWorkspace,
  groupingSkillPhrase,
  placeCountsSize,
  placeCountsValue,
  type PlaceCounts,
} from "./grouping";
import type { GradeBand } from "@/lib/domain/onboarding";
import { TRADE_AT, overfullPlace } from "./grouping";

const BANDS: readonly GradeBand[] = ["k-1", "2-3", "4-5"];

describe("place units", () => {
  it("reads largest first, as the mat does", () => {
    expect(PLACE_UNITS).toEqual([1000, 100, 10, 1]);
  });

  it("labels every denomination", () => {
    for (const unit of PLACE_UNITS) {
      expect(PLACE_LABEL[unit].length).toBeGreaterThan(0);
    }
  });
});

describe("digitAt", () => {
  it("picks the digit out of each place", () => {
    expect(digitAt(1234, 1000)).toBe(1);
    expect(digitAt(1234, 100)).toBe(2);
    expect(digitAt(1234, 10)).toBe(3);
    expect(digitAt(1234, 1)).toBe(4);
  });

  it("reads zero places as zero", () => {
    expect(digitAt(7, 10)).toBe(0);
    expect(digitAt(1005, 10)).toBe(0);
    expect(digitAt(0, 1)).toBe(0);
  });

  it("reconstructs any number from its digits", () => {
    for (const value of [0, 7, 42, 100, 305, 999, 1000, 4821]) {
      const rebuilt = PLACE_UNITS.reduce((sum, unit) => sum + digitAt(value, unit) * unit, 0);
      expect(rebuilt).toBe(value);
    }
  });
});

describe("counting blocks on the mat", () => {
  const counts: PlaceCounts = { 1000: 1, 100: 2, 10: 3, 1: 4 };

  it("adds up their value", () => {
    expect(placeCountsValue(counts)).toBe(1234);
    expect(placeCountsValue(EMPTY_PLACE_COUNTS)).toBe(0);
  });

  it("counts how many there are", () => {
    expect(placeCountsSize(counts)).toBe(10);
    expect(placeCountsSize(EMPTY_PLACE_COUNTS)).toBe(0);
  });

  it("values loose blocks the same as grouped ones", () => {
    expect(placeCountsValue({ 1000: 0, 100: 0, 10: 0, 1: 12 })).toBe(
      placeCountsValue({ 1000: 0, 100: 0, 10: 1, 1: 2 }),
    );
  });
});

describe("emptyWorkspace", () => {
  it("matches the shape of an array task", () => {
    const workspace = emptyWorkspace({
      kind: "array",
      index: 0,
      rows: 2,
      cols: 3,
      stripChoices: [3],
    });
    expect(workspace).toEqual({ kind: "array", strips: [] });
  });

  it("matches the shape of a place-value task", () => {
    const workspace = emptyWorkspace({
      kind: "place-value",
      index: 0,
      target: 34,
      unitChoices: [10, 1],
    });
    expect(workspace).toEqual({ kind: "place-value", counts: EMPTY_PLACE_COUNTS });
  });
});

describe("GROUPING_BAND_RANGES", () => {
  it("covers every band with sane array bounds", () => {
    for (const band of BANDS) {
      const { array } = GROUPING_BAND_RANGES[band];
      expect(array.minRows).toBeGreaterThanOrEqual(2);
      expect(array.minRows).toBeLessThanOrEqual(array.maxRows);
      expect(array.minCols).toBeLessThanOrEqual(array.maxCols);
      expect(array.description.length).toBeGreaterThan(0);
    }
  });

  it("grows the array facts as the band goes up", () => {
    expect(GROUPING_BAND_RANGES["k-1"].array.maxRows).toBeLessThan(
      GROUPING_BAND_RANGES["4-5"].array.maxRows,
    );
    expect(GROUPING_BAND_RANGES["k-1"].array.maxCols).toBeLessThan(
      GROUPING_BAND_RANGES["4-5"].array.maxCols,
    );
  });

  it("keeps place-value bounds coherent, with a real block budget", () => {
    for (const band of BANDS) {
      const { placeValue } = GROUPING_BAND_RANGES[band];
      expect(PLACE_UNITS).toContain(placeValue.topUnit);
      expect(PLACE_UNITS).toContain(placeValue.minTopUnit);
      expect(placeValue.minTopUnit).toBeLessThanOrEqual(placeValue.topUnit);
      expect(placeValue.minTopDigit).toBeGreaterThanOrEqual(1);
      expect(placeValue.minTopDigit).toBeLessThanOrEqual(9);
      expect(placeValue.maxBlocks).toBeGreaterThanOrEqual(9);
      expect(placeValue.description.length).toBeGreaterThan(0);
    }
  });

  it("moves 2-3 past the K-1 teens, so the bands do not repeat each other", () => {
    expect(GROUPING_BAND_RANGES["2-3"].placeValue.minTopDigit).toBeGreaterThan(
      GROUPING_BAND_RANGES["k-1"].placeValue.minTopDigit,
    );
  });

  it("reaches thousands only in the top band", () => {
    expect(GROUPING_BAND_RANGES["k-1"].placeValue.topUnit).toBe(10);
    expect(GROUPING_BAND_RANGES["2-3"].placeValue.topUnit).toBe(10);
    expect(GROUPING_BAND_RANGES["4-5"].placeValue.topUnit).toBe(1000);
  });
});

describe("groupingSkillPhrase", () => {
  it("reads inside a sentence for both focuses", () => {
    expect(`You are better at ${groupingSkillPhrase("array")}.`).toBe(
      "You are better at building arrays.",
    );
    expect(groupingSkillPhrase("place-value")).toBe("grouping tens and hundreds");
  });
});

describe("overfullPlace: the ten that make one", () => {
  it("finds nothing on a canonical mat", () => {
    // 243 built properly: 2 hundreds, 4 tens, 3 ones.
    expect(overfullPlace({ 1000: 0, 100: 2, 10: 4, 1: 3 }, [100, 10, 1])).toBeNull();
  });

  it("names the place to trade and where it goes", () => {
    // 14 as fourteen ones — the right total, without the idea.
    expect(overfullPlace({ 1000: 0, 100: 0, 10: 0, 1: 14 }, [10, 1])).toEqual({ from: 1, to: 10 });
  });

  it("works on the lowest place first, which is where a child starts", () => {
    expect(overfullPlace({ 1000: 0, 100: 0, 10: 12, 1: 11 }, [100, 10, 1])).toEqual({ from: 1, to: 10 });
  });

  it("never asks to trade the top place, which has nowhere to go", () => {
    // Twelve hundreds on a hundreds-topped mat: nothing above to trade into.
    expect(overfullPlace({ 1000: 0, 100: 12, 10: 0, 1: 0 }, [100, 10, 1])).toBeNull();
  });

  it("waits for a full ten, so nine is left alone", () => {
    expect(overfullPlace({ 1000: 0, 100: 0, 10: 0, 1: 9 }, [10, 1])).toBeNull();
    expect(overfullPlace({ 1000: 0, 100: 0, 10: 0, 1: TRADE_AT }, [10, 1])).toEqual({ from: 1, to: 10 });
  });
});
