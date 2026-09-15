import { describe, expect, it } from "vitest";
import {
  matReading,
  placeName,
  placeReading,
  spokenTradeTask,
  tradeHint,
  tradeInstruction,
  tradeQuestion,
  tradeSubtitle,
} from "./tradeCopy";
import type { PlaceCounts, PlaceUnit } from "./grouping";
import type { GradeBand } from "./onboarding";
import type { TradeSlip } from "./tradeDiagnosis";

const BANDS: readonly GradeBand[] = ["k-1", "2-3", "4-5"];
const SLIPS: readonly TradeSlip[] = [
  "places-side-by-side",
  "forgot-to-carry",
  "off-by-one",
  "one-place-only",
  "miscounted",
];
const TENS_ONES: readonly PlaceUnit[] = [10, 1];
const TO_THOUSANDS: readonly PlaceUnit[] = [1000, 100, 10, 1];

function counts(partial: Partial<Record<PlaceUnit, number>>): PlaceCounts {
  return { 1000: 0, 100: 0, 10: 0, 1: 0, ...partial };
}

describe("placeReading: the mat in words", () => {
  it("names every place in play, left to right, empty ones included", () => {
    expect(placeReading(counts({ 10: 7, 1: 14 }), TENS_ONES)).toBe("7 tens and 14 ones");
    expect(placeReading(counts({ 1000: 2, 100: 3, 10: 1, 1: 5 }), TO_THOUSANDS)).toBe(
      "2 thousands, 3 hundreds, 1 ten and 5 ones",
    );
    expect(placeReading(counts({ 1000: 1, 1: 4 }), TO_THOUSANDS)).toBe(
      "1 thousand, 0 hundreds, 0 tens and 4 ones",
    );
  });

  it("uses the singular for exactly one", () => {
    expect(placeReading(counts({ 10: 1, 1: 1 }), TENS_ONES)).toBe("1 ten and 1 one");
    expect(placeReading(counts({ 100: 1 }), [100])).toBe("1 hundred");
  });

  it("lowercases the column label, so the words match the mat", () => {
    expect(placeName(10)).toBe("tens");
    expect(placeName(1000)).toBe("thousands");
  });
});

describe("the question never carries the answer", () => {
  it("asks in words, with no digit anywhere", () => {
    for (const band of BANDS) {
      expect(tradeQuestion(band)).not.toMatch(/\d/);
      expect(tradeInstruction(band)).not.toMatch(/\d/);
      expect(tradeSubtitle(band)).not.toMatch(/\d/);
    }
  });

  it("gives K-1 concrete words: no long way, place or digit", () => {
    const lines = [
      tradeSubtitle("k-1"),
      tradeQuestion("k-1"),
      tradeInstruction("k-1"),
      ...SLIPS.map((slip) => tradeHint("k-1", slip)),
    ];
    for (const line of lines) {
      expect(line).not.toMatch(/long way|short way|place|\d/i);
    }
  });
});

describe("matReading: the mat as a sum, once the number is found", () => {
  it("reads the shape on the left and the value on the right", () => {
    expect(matReading("2-3", counts({ 10: 7, 1: 14 }), TENS_ONES, 84)).toBe("7 tens and 14 ones = 84");
  });

  it("says it in words for K-1", () => {
    expect(matReading("k-1", counts({ 1: 14 }), TENS_ONES, 14)).toBe("0 tens and 14 ones make 14");
  });
});

describe("tradeHint: what the slip was, without a digit", () => {
  it("has a different line for every slip, in every band, and none carries a number", () => {
    for (const band of BANDS) {
      const lines = SLIPS.map((slip) => tradeHint(band, slip));
      expect(new Set(lines).size).toBe(SLIPS.length);
      for (const line of lines) expect(line).not.toMatch(/\d/);
    }
  });

  it("names the carry for a forgotten carry and the side-by-side for glued counts", () => {
    expect(tradeHint("2-3", "forgot-to-carry")).toMatch(/carry/i);
    expect(tradeHint("2-3", "places-side-by-side")).toMatch(/counts, not the digits/i);
  });
});

describe("spokenTradeTask: read aloud", () => {
  it("reads the story first when there is one, then the mat, and never the value", () => {
    const line = spokenTradeTask(TENS_ONES, counts({ 10: 7, 1: 14 }), "Mira packed bananas.");
    expect(line.startsWith("Mira packed bananas. ")).toBe(true);
    expect(line).toContain("7 tens and 14 ones");
    expect(line).not.toContain("84");
  });

  it("stands alone without a story", () => {
    expect(spokenTradeTask(TENS_ONES, counts({ 1: 18 }), null)).toMatch(/^The mat shows 0 tens and 18 ones/);
  });
});
