import { describe, expect, it } from "vitest";
import { DIFFICULTY_LEVELS } from "@/lib/domain/difficulty";
import type { GradeBand } from "@/lib/domain/onboarding";
import { diagnoseJump } from "@/lib/domain/jumpDiagnosis";
import { generateJumpProblem } from "@/lib/math/numberLineProblems";
import { JUMP_CHOICES, jumpChoices } from "./jumpChoices";

const BANDS: readonly GradeBand[] = ["k-1", "2-3", "4-5"];
const SWEEP = 40;

/** Camp 2 is the crossing camp, so that is the skill these choices serve. */
function everyBoard() {
  const boards = [];
  for (const band of BANDS) {
    for (const level of DIFFICULTY_LEVELS) {
      for (let index = 0; index < SWEEP; index += 1) {
        const problem = generateJumpProblem("cross-place", band, level, index);
        boards.push({ band, level, index, problem, choices: jumpChoices(problem, band) });
      }
    }
  }
  return boards;
}

describe("jumpChoices", () => {
  it("always offers the right landing", () => {
    for (const { problem, choices } of everyBoard()) {
      expect(choices).toContain(problem.answer);
    }
  });

  it("always offers exactly four, all different", () => {
    for (const { choices } of everyBoard()) {
      expect(choices).toHaveLength(JUMP_CHOICES);
      expect(new Set(choices).size).toBe(JUMP_CHOICES);
    }
  });

  it("never offers a landing off the line, or below zero", () => {
    for (const { problem, choices } of everyBoard()) {
      for (const choice of choices) {
        expect(choice).toBeGreaterThanOrEqual(problem.line.min);
        expect(choice).toBeLessThanOrEqual(problem.line.max);
        expect(choice).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("makes every wrong choice a slip the coach can name", () => {
    for (const { problem, choices } of everyBoard()) {
      for (const choice of choices) {
        if (choice === problem.answer) continue;
        const slip = diagnoseJump(problem, choice);
        expect(slip.kind).toBeTruthy();
        // The nudge is what reaches the model, and it must never carry a digit.
        expect(slip.nudge).not.toMatch(/\d/);
      }
    }
  });

  it("is deterministic, so the same problem always offers the same board", () => {
    for (const { band, problem, choices } of everyBoard().slice(0, 60)) {
      expect(jumpChoices(problem, band)).toEqual(choices);
    }
  });

  it("does not always put the answer in the same place", () => {
    const positions = new Set(
      everyBoard().map(({ problem, choices }) => choices.indexOf(problem.answer)),
    );
    expect(positions.size).toBeGreaterThan(1);
  });
});
