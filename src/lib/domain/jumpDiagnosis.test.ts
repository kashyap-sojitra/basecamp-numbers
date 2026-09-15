import { describe, expect, it } from "vitest";
import { diagnoseJump } from "./jumpDiagnosis";
import { generateJumpProblem } from "@/lib/math/numberLineProblems";
import { DIFFICULTY_LEVELS } from "@/lib/domain/difficulty";
import type { GradeBand } from "@/lib/domain/onboarding";

const BANDS: readonly GradeBand[] = ["k-1", "2-3", "4-5"];
const SKILLS = ["within-place", "cross-place"] as const;

/** Every problem the app can set, with every tick a child could land on. */
function everyWrongLanding(): { problem: ReturnType<typeof generateJumpProblem>; landed: number }[] {
  const out: { problem: ReturnType<typeof generateJumpProblem>; landed: number }[] = [];
  for (const band of BANDS) {
    for (const skill of SKILLS) {
      for (const level of DIFFICULTY_LEVELS) {
        for (let index = 0; index < 12; index += 1) {
          const problem = generateJumpProblem(skill, band, level, index);
          for (let tick = problem.line.min; tick <= problem.line.max; tick += 1) {
            if (tick !== problem.answer) out.push({ problem, landed: tick });
          }
        }
      }
    }
  }
  return out;
}

describe("diagnoseJump", () => {
  const cases = everyWrongLanding();

  it("has something to say about every wrong landing the line allows", () => {
    expect(cases.length).toBeGreaterThan(5_000);
    for (const { problem, landed } of cases) {
      expect(diagnoseJump(problem, landed).nudge.length).toBeGreaterThan(10);
    }
  });

  it("never leaks a number, so the nudge cannot give the answer away", () => {
    // Digit-free by construction. The coach is handed this verbatim, and the
    // framing guard's rule — the model may phrase, never compute — only holds
    // if what we hand it carries no arithmetic.
    for (const { problem, landed } of cases) {
      expect(diagnoseJump(problem, landed).nudge).not.toMatch(/\d/);
    }
  });

  it("never scolds: the copy rule holds here too", () => {
    for (const word of ["wrong", "no", "failed", "bad", "incorrect"]) {
      for (const { problem, landed } of cases.slice(0, 500)) {
        const nudge = diagnoseJump(problem, landed).nudge.toLowerCase();
        expect(nudge.split(/\b/).includes(word)).toBe(false);
      }
    }
  });

  it("names the slip, not just 'try again'", () => {
    const kinds = new Set(cases.map(({ problem, landed }) => diagnoseJump(problem, landed).kind));
    // A generic fallback exists, but it must not be the only thing that fires.
    expect(kinds.size).toBeGreaterThan(4);
  });

  it("reads a tap as not having moved", () => {
    const p = generateJumpProblem("cross-place", "k-1", 3, 0);
    expect(diagnoseJump(p, p.start).kind).toBe("did-not-move");
  });

  it("reads the right jump the wrong way as a direction slip", () => {
    const p = generateJumpProblem("cross-place", "k-1", 3, 0);
    const backwards = p.start - (p.answer - p.start);
    expect(diagnoseJump(p, backwards).kind).toBe("wrong-direction");
  });

  it("reads one tick out as counting the starting tick", () => {
    const p = generateJumpProblem("within-place", "2-3", 3, 0);
    expect(diagnoseJump(p, p.answer - 1).kind).toBe("off-by-one");
    expect(diagnoseJump(p, p.answer + 1).kind).toBe("off-by-one");
  });

  it("reads a missing carry as a trade that did not happen", () => {
    const p = generateJumpProblem("cross-place", "2-3", 3, 0);
    expect(diagnoseJump(p, p.answer - 10).kind).toBe("missed-the-regroup");
  });

  it("is stable: the same landing always gets the same reading", () => {
    const p = generateJumpProblem("cross-place", "4-5", 4, 2);
    const first = diagnoseJump(p, p.answer - 3);
    for (let i = 0; i < 20; i += 1) expect(diagnoseJump(p, p.answer - 3)).toEqual(first);
  });
});
