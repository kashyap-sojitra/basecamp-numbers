import { describe, expect, it } from "vitest";
import {
  MASTERY_MAX,
  UNLOCK_MASTERY,
  addMastery,
  isCampComplete,
  masteryGain,
  masterySchema,
} from "./mastery";

describe("masterySchema", () => {
  it("accepts the whole meter range", () => {
    for (const value of [0, 1, 50, MASTERY_MAX]) {
      expect(masterySchema.parse(value)).toBe(value);
    }
  });

  it("refuses anything off the meter", () => {
    for (const bad of [-1, MASTERY_MAX + 1, 1.5, "50", null, NaN]) {
      expect(masterySchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("masteryGain", () => {
  it("pays more for a clean first landing", () => {
    expect(masteryGain(0)).toBeGreaterThan(masteryGain(1));
  });

  it("pays the same however many wobbles there were", () => {
    expect(masteryGain(1)).toBe(masteryGain(5));
  });

  it("never pays nothing, so a wobbly answer still moves the meter", () => {
    for (const wrong of [0, 1, 2, 9]) {
      expect(masteryGain(wrong)).toBeGreaterThan(0);
    }
  });
});

describe("addMastery", () => {
  it("adds the gain", () => {
    expect(addMastery(10, 14)).toBe(24);
  });

  it("stops at the top of the meter", () => {
    expect(addMastery(95, 14)).toBe(MASTERY_MAX);
    expect(addMastery(MASTERY_MAX, 14)).toBe(MASTERY_MAX);
  });

  it("only ever rises", () => {
    let mastery = 0;
    for (let i = 0; i < 30; i += 1) {
      const next = addMastery(mastery, masteryGain(i % 2));
      expect(next).toBeGreaterThanOrEqual(mastery);
      mastery = next;
    }
    expect(mastery).toBe(MASTERY_MAX);
  });

  it("reaches a full meter in a believable number of clean solves", () => {
    let mastery = 0;
    let solves = 0;
    while (!isCampComplete(mastery) && solves < 100) {
      mastery = addMastery(mastery, masteryGain(0));
      solves += 1;
    }
    expect(solves).toBe(8);
  });
});

describe("isCampComplete", () => {
  it("is true only at a full meter", () => {
    expect(isCampComplete(MASTERY_MAX - 1)).toBe(false);
    expect(isCampComplete(MASTERY_MAX)).toBe(true);
  });

  it("agrees with the unlock threshold, so completing a camp opens the next", () => {
    expect(UNLOCK_MASTERY).toBe(MASTERY_MAX);
    expect(isCampComplete(UNLOCK_MASTERY)).toBe(true);
  });
});
