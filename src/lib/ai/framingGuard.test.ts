import { describe, expect, it } from "vitest";
import { checkFraming, expectedAnswer, requiredNumbers } from "./framingGuard";
import type { FramingRequest } from "./types";

const jump: FramingRequest = {
  kind: "jump",
  theme: "space",
  operation: "add",
  start: 12,
  change: 5,
};

const subtract: FramingRequest = { ...jump, operation: "subtract" };

const array: FramingRequest = { kind: "array", theme: "ocean", rows: 3, cols: 4 };

const placeValue: FramingRequest = { kind: "place-value", theme: "jungle", target: 342 };

describe("expectedAnswer", () => {
  it("computes the jump locally, in both directions", () => {
    expect(expectedAnswer(jump)).toBe(17);
    expect(expectedAnswer(subtract)).toBe(7);
  });

  it("multiplies an array", () => {
    expect(expectedAnswer(array)).toBe(12);
  });

  it("takes a place-value target as its own answer", () => {
    expect(expectedAnswer(placeValue)).toBe(342);
  });
});

describe("requiredNumbers", () => {
  it("names the operands the story must mention, and not the answer", () => {
    expect(requiredNumbers(jump)).toEqual([12, 5]);
    expect(requiredNumbers(array)).toEqual([3, 4]);
    expect(requiredNumbers(placeValue)).toEqual([342]);
    expect(requiredNumbers(jump)).not.toContain(expectedAnswer(jump));
  });
});

describe("checkFraming: accepting good framings", () => {
  it("accepts a story using exactly the operands", () => {
    expect(
      checkFraming(jump, "A rocket passes 12 moons, then flies past 5 more.", "Where is it now?"),
    ).toEqual({ ok: true });
  });

  it("accepts an array story", () => {
    expect(
      checkFraming(array, "Coral grows in 3 rows of 4 polyps.", "How many polyps?"),
    ).toEqual({ ok: true });
  });

  it("accepts a place-value story, where the target is the number named", () => {
    expect(
      checkFraming(placeValue, "The toucan counted 342 seeds.", "Build 342 with blocks."),
    ).toEqual({ ok: true });
  });

  it("accepts numbers written more than once", () => {
    expect(
      checkFraming(jump, "12 stars, then 5 stars, then 5 again — no, just 5.", "Where now?"),
    ).toEqual({ ok: true });
  });

  it("accepts a story with no extra digits at all beyond the operands", () => {
    expect(checkFraming(jump, "Twelve is 12 and five is 5.", "Total?")).toEqual({ ok: true });
  });
});

describe("checkFraming: refusing bad framings", () => {
  it("refuses a story missing an operand", () => {
    const result = checkFraming(jump, "A rocket passes 12 moons.", "Where is it now?");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("missing the number 5");
  });

  it("refuses a story that gives the answer away", () => {
    const result = checkFraming(jump, "12 moons plus 5 makes 17.", "Where is it now?");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("gives the answer");
  });

  it("refuses a story that invents a number", () => {
    const result = checkFraming(jump, "A rocket with 3 engines passes 12 moons and 5 stars.", "Now?");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("invented the number 3");
  });

  it("refuses an array story that leaks the product", () => {
    const result = checkFraming(array, "3 rows of 4 makes 12 polyps.", "How many?");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("gives the answer");
  });

  it("refuses markup, which would render as literal characters to a child", () => {
    for (const markup of ["**bold**", "_italic_", "# heading", "`code`", "a | b", "<b>", "{x}"]) {
      const result = checkFraming(jump, `12 moons and 5 stars ${markup}`, "Where now?");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("contains markup");
    }
  });
});

describe("checkFraming: the cases that need care", () => {
  it("allows the answer when it is also an operand", () => {
    // 0 + 5 = 5, so mentioning 5 is unavoidable and must not be a leak.
    const zeroStart: FramingRequest = { ...jump, start: 0, change: 5 };
    expect(checkFraming(zeroStart, "0 moons, then 5 more.", "How many?")).toEqual({ ok: true });
  });

  it("allows a doubling array, where rows, cols and product can coincide", () => {
    const oneRow: FramingRequest = { kind: "array", theme: "ocean", rows: 1, cols: 4 };
    expect(checkFraming(oneRow, "1 row of 4 shells.", "How many shells?")).toEqual({ ok: true });
  });

  it("lets a place-value story say its target, which is both operand and answer", () => {
    expect(checkFraming(placeValue, "Build 342.", "How many hundreds in 342?")).toEqual({
      ok: true,
    });
  });

  it("reads a number inside a word as a number, so 'level5' cannot smuggle one in", () => {
    const result = checkFraming(jump, "12 moons and 5 stars at level9.", "Where?");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("invented the number 9");
  });

  it("checks the question as well as the story", () => {
    const result = checkFraming(jump, "A rocket passes 12 moons and 5 stars.", "Is it at 17?");
    expect(result.ok).toBe(false);
  });

  it("accepts plain punctuation, hyphens and apostrophes", () => {
    expect(
      checkFraming(jump, "The rocket's path: 12 moons — then 5 more!", "Where is it now?"),
    ).toEqual({ ok: true });
  });

  it("never throws, whatever the model sends", () => {
    for (const text of ["", " ", "no numbers here", "9".repeat(400), "🚀🚀🚀"]) {
      expect(() => checkFraming(jump, text, text)).not.toThrow();
    }
  });
});
