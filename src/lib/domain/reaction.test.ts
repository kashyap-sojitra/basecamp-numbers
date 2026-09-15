import { describe, expect, it } from "vitest";
import {
  CLOSE_TICKS,
  MISS_WORDS,
  tradeMiss,
  YAY,
  groupingMiss,
  jumpMiss,
  reactionWord,
  type MissTone,
} from "./reaction";
import { generateJumpProblem } from "@/lib/math/numberLineProblems";
import { DIFFICULTY_LEVELS } from "@/lib/domain/difficulty";
import type { JumpProblem } from "@/lib/domain/numberLine";
import type { GradeBand } from "@/lib/domain/onboarding";
import type { JumpSkill } from "@/lib/domain/camp";
import type { GroupingHint } from "@/lib/domain/groupingSession";

const BANDS: readonly GradeBand[] = ["k-1", "2-3", "4-5"];
const SKILLS: readonly JumpSkill[] = ["within-place", "cross-place"];
const TONES: readonly MissTone[] = ["close", "off", "far", "too-many", "not-yet"];

const problem: JumpProblem = {
  index: 0,
  operation: "add",
  start: 34,
  change: 8,
  answer: 42,
  line: { min: 30, max: 50 },
};

describe("jumpMiss: the stamp says how far off the landing was", () => {
  it("is close one tick either side", () => {
    expect(jumpMiss(problem, 41)).toEqual({ kind: "miss", tone: "close" });
    expect(jumpMiss(problem, 43)).toEqual({ kind: "miss", tone: "close" });
  });

  it("is off when short of the answer by less than the jump", () => {
    expect(jumpMiss(problem, 39)).toEqual({ kind: "miss", tone: "off" });
    expect(jumpMiss(problem, 44)).toEqual({ kind: "miss", tone: "off" });
  });

  it("is far when the child did not move — the whole jump away", () => {
    expect(jumpMiss(problem, problem.start)).toEqual({ kind: "miss", tone: "far" });
  });

  it("is far when the child jumped the right size the wrong way", () => {
    expect(jumpMiss(problem, problem.start - problem.change)).toEqual({ kind: "miss", tone: "far" });
  });

  it("never calls a landing close unless it is within CLOSE_TICKS, on every problem", () => {
    for (const band of BANDS) for (const skill of SKILLS) for (const level of DIFFICULTY_LEVELS) {
      for (let index = 0; index < 60; index += 1) {
        const p = generateJumpProblem(skill, band, level, index);
        for (let landed = p.line.min; landed <= p.line.max; landed += 1) {
          if (landed === p.answer) continue;
          const tone = jumpMiss(p, landed);
          expect(tone.kind).toBe("miss");
          if (tone.kind !== "miss") continue;
          const distance = Math.abs(landed - p.answer);
          if (tone.tone === "close") expect(distance).toBeLessThanOrEqual(CLOSE_TICKS);
          if (tone.tone === "far") expect(distance).toBeGreaterThanOrEqual(p.change);
          if (tone.tone === "off") {
            expect(distance).toBeGreaterThan(CLOSE_TICKS);
            expect(distance).toBeLessThan(p.change);
          }
        }
      }
    }
  });
});

describe("groupingMiss and the trade mat", () => {
  it("says too many when the build has overshot", () => {
    expect(groupingMiss("too-many")).toEqual({ kind: "miss", tone: "too-many" });
    expect(groupingMiss("over-target")).toEqual({ kind: "miss", tone: "too-many" });
  });

  it("says not yet for a shape that is wrong rather than a count that is off", () => {
    for (const hint of ["wrong-strip", "uneven-rows", "needs-regroup"] as const satisfies readonly GroupingHint[]) {
      expect(groupingMiss(hint)).toEqual({ kind: "miss", tone: "not-yet" });
    }
  });

  it("a wrong number for the mat is measured against its value", () => {
    expect(tradeMiss(85, 84)).toEqual({ kind: "miss", tone: "close" });
    expect(tradeMiss(80, 84)).toEqual({ kind: "miss", tone: "off" });
    expect(tradeMiss(714, 84)).toEqual({ kind: "miss", tone: "far" });
    expect(tradeMiss(74, 84)).toEqual({ kind: "miss", tone: "far" });
  });
});

describe("the words", () => {
  it("has a word for every tone, and YAY for a win", () => {
    expect(reactionWord(YAY)).toBe("YAY!");
    for (const tone of TONES) {
      expect(reactionWord({ kind: "miss", tone })).toBe(MISS_WORDS[tone]);
      expect(MISS_WORDS[tone].length).toBeGreaterThan(0);
    }
  });

  it("never says nearly, wrong, no, or anything a child could hear as a telling-off", () => {
    for (const tone of TONES) {
      expect(MISS_WORDS[tone]).not.toMatch(/\b(nearly|wrong|no|bad|oops|fail|missed)\b/i);
    }
  });

  it("keeps every word short enough for a stamp and a K-1 reader", () => {
    for (const tone of TONES) {
      expect(MISS_WORDS[tone].split(" ").length).toBeLessThanOrEqual(2);
      expect(MISS_WORDS[tone].length).toBeLessThanOrEqual(12);
    }
  });
});
