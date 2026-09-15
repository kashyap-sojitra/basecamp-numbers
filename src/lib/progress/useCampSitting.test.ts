import { describe, expect, it } from "vitest";
import { answerOutcome } from "./useCampSitting";

/**
 * The hook itself is exercised through the camp screens' own tests, which is
 * where its behaviour is visible. This pins the one pure rule it carries.
 */
describe("answerOutcome", () => {
  it("treats a first-time answer as its own kind of success", () => {
    expect(answerOutcome(true, 0)).toBe("correct-first-try");
  });

  it("keeps a right answer after a wobble distinct, so the words can differ", () => {
    expect(answerOutcome(true, 1)).toBe("correct-after-retry");
    expect(answerOutcome(true, 5)).toBe("correct-after-retry");
  });

  it("reports a wrong answer regardless of how many came before it", () => {
    expect(answerOutcome(false, 0)).toBe("incorrect");
    expect(answerOutcome(false, 3)).toBe("incorrect");
  });
});
