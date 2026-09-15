import { describe, expect, it } from "vitest";
import { spokenGrouping, spokenJump } from "./spokenProblem";
import type { JumpProblem } from "@/lib/domain/numberLine";
import type { GroupingTask } from "@/lib/domain/grouping";
import type { WordProblemFraming } from "./types";

const add: JumpProblem = {
  index: 0,
  operation: "add",
  start: 8,
  change: 7,
  answer: 15,
  line: { min: 0, max: 20 },
};

const subtract: JumpProblem = { ...add, operation: "subtract", answer: 1 };

const framing: WordProblemFraming = {
  story: "Captain Luna finds 8 moon rocks.",
  question: "She gathers 7 more. How many now?",
  source: "template",
};

describe("spokenJump", () => {
  it("speaks the bare sum in English when there is no word problem yet", () => {
    expect(spokenJump(add, null)).toBe("8 plus 7 equals what?");
    expect(spokenJump(subtract, null)).toBe("8 minus 7 equals what?");
  });

  it("never reads out a symbol a screen reader would mangle", () => {
    for (const problem of [add, subtract]) {
      const spoken = spokenJump(problem, null);
      expect(spoken).not.toContain("+");
      expect(spoken).not.toContain("=");
      expect(spoken).not.toContain("−");
    }
  });

  it("reads the word problem first, then the sum, once the words arrive", () => {
    const spoken = spokenJump(add, framing);
    expect(spoken.startsWith(framing.story)).toBe(true);
    expect(spoken).toContain(framing.question);
    expect(spoken.endsWith("8 plus 7 equals what?")).toBe(true);
  });

  it("never gives the answer away", () => {
    expect(spokenJump(add, null)).not.toContain("15");
    expect(spokenJump(add, framing)).not.toContain("15");
  });
});

describe("spokenGrouping", () => {
  const array: GroupingTask = { kind: "array", index: 0, rows: 3, cols: 4, stripChoices: [4] };
  const placeValue: GroupingTask = {
    kind: "place-value",
    index: 0,
    target: 342,
    unitChoices: [100, 10, 1],
  };

  it("asks an array task in words", () => {
    expect(spokenGrouping(array, null)).toBe("3 rows of 4. How many altogether?");
  });

  it("asks a place-value task in words", () => {
    expect(spokenGrouping(placeValue, null)).toBe("Build the number 342.");
  });

  it("reads the word problem first when it has arrived", () => {
    const spoken = spokenGrouping(array, framing);
    expect(spoken.startsWith(framing.story)).toBe(true);
    expect(spoken.endsWith("3 rows of 4. How many altogether?")).toBe(true);
  });

  it("never gives an array's product away", () => {
    expect(spokenGrouping(array, null)).not.toContain("12");
  });
});
