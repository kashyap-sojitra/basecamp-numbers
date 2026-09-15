import { describe, expect, it } from "vitest";
import {
  CAMP_NUMBERS,
  PREVIOUS_CAMP,
  campNumberSchema,
  mechanicLabel,
  type CampNumber,
} from "./camp";

describe("campNumberSchema", () => {
  it("accepts exactly the four camps", () => {
    for (const camp of [1, 2, 3, 4]) {
      expect(campNumberSchema.parse(camp)).toBe(camp);
    }
  });

  it("refuses anything that is not one of the four", () => {
    for (const bad of [0, 5, -1, 1.5, "1", null, undefined, NaN]) {
      expect(campNumberSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("the shape of the mountain", () => {
  it("has four camps, low to high", () => {
    expect(CAMP_NUMBERS).toEqual([1, 2, 3, 4]);
  });

  it("chains every camp back to the trailhead", () => {
    expect(PREVIOUS_CAMP[1]).toBeNull();
    for (const camp of [2, 3, 4] as const) {
      expect(PREVIOUS_CAMP[camp]).toBe(camp - 1);
    }
  });

  it("reaches camp 1 from every camp by walking down", () => {
    for (const start of CAMP_NUMBERS) {
      let at: CampNumber = start;
      let steps = 0;
      while (steps < 10) {
        const below = PREVIOUS_CAMP[at];
        if (below === null) break;
        at = below;
        steps += 1;
      }
      expect(at).toBe(1);
    }
  });
});

describe("mechanicLabel", () => {
  it("names all four mechanic variants distinctly", () => {
    const labels = [
      mechanicLabel({ kind: "number-line-jump", skill: "within-place" }),
      mechanicLabel({ kind: "number-line-jump", skill: "cross-place" }),
      mechanicLabel({ kind: "array-grouping", focus: "array" }),
      mechanicLabel({ kind: "array-grouping", focus: "place-value" }),
    ];
    expect(new Set(labels).size).toBe(4);
    expect(labels.every((label) => label.length > 0)).toBe(true);
  });
});
