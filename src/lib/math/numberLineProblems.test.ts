import { describe, expect, it } from "vitest";
import { borrowsSubtracting, carriesAdding, generateJumpProblem, generateJumpSequence } from "./numberLineProblems";
import { BAND_RANGES, type JumpProblem } from "@/lib/domain/numberLine";
import { DIFFICULTY_LEVELS, type DifficultyLevel } from "@/lib/domain/difficulty";
import type { JumpSkill } from "@/lib/domain/camp";
import type { GradeBand } from "@/lib/domain/onboarding";

const BANDS: readonly GradeBand[] = ["k-1", "2-3", "4-5"];
const SKILLS: readonly JumpSkill[] = ["within-place", "cross-place"];

/** Every band × skill × level, which is the whole surface of the generator. */
function everyCombination(): readonly {
  band: GradeBand;
  skill: JumpSkill;
  level: DifficultyLevel;
}[] {
  const out: { band: GradeBand; skill: JumpSkill; level: DifficultyLevel }[] = [];
  for (const band of BANDS) {
    for (const skill of SKILLS) {
      for (const level of DIFFICULTY_LEVELS) out.push({ band, skill, level });
    }
  }
  return out;
}

const SWEEP = 250;

describe("generateJumpProblem: arithmetic", () => {
  it("always states a jump whose answer is its own arithmetic", () => {
    for (const { band, skill, level } of everyCombination()) {
      for (let index = 0; index < SWEEP; index += 1) {
        const problem = generateJumpProblem(skill, band, level, index);
        const expected =
          problem.operation === "add"
            ? problem.start + problem.change
            : problem.start - problem.change;
        expect(problem.answer).toBe(expected);
      }
    }
  });

  it("uses only whole numbers", () => {
    for (const { band, skill, level } of everyCombination()) {
      for (let index = 0; index < 40; index += 1) {
        const problem = generateJumpProblem(skill, band, level, index);
        for (const value of [problem.start, problem.change, problem.answer]) {
          expect(Number.isInteger(value)).toBe(true);
        }
      }
    }
  });

  it("carries the index it was asked for", () => {
    for (let index = 0; index < 20; index += 1) {
      expect(generateJumpProblem("within-place", "2-3", 3, index).index).toBe(index);
    }
  });
});

describe("generateJumpProblem: staying in the band", () => {
  it("never goes below zero or above the band's ceiling", () => {
    for (const { band, skill, level } of everyCombination()) {
      const { ceiling } = BAND_RANGES[band];
      for (let index = 0; index < SWEEP; index += 1) {
        const problem = generateJumpProblem(skill, band, level, index);
        for (const value of [problem.start, problem.answer]) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(ceiling);
        }
      }
    }
  });

  it("keeps the jump inside the band's bounds", () => {
    for (const { band, skill, level } of everyCombination()) {
      const { minChange, maxChange } = BAND_RANGES[band];
      for (let index = 0; index < SWEEP; index += 1) {
        const { change } = generateJumpProblem(skill, band, level, index);
        expect(change).toBeGreaterThanOrEqual(Math.min(minChange, maxChange));
        expect(change).toBeLessThanOrEqual(maxChange);
      }
    }
  });

  it("always jumps somewhere", () => {
    for (const { band, skill, level } of everyCombination()) {
      for (let index = 0; index < 60; index += 1) {
        expect(generateJumpProblem(skill, band, level, index).change).toBeGreaterThan(0);
      }
    }
  });
});

describe("generateJumpProblem: the skill it claims to practise", () => {
  /** Whether this problem needs a carry or a borrow anywhere. */
  function regroups(problem: JumpProblem, ceiling: number): boolean {
    return problem.operation === "add"
      ? carriesAdding(problem.start, problem.change, ceiling)
      : borrowsSubtracting(problem.start, problem.change, ceiling);
  }

  it("never regroups on a within-place jump — that is the whole of the gentler skill", () => {
    for (const band of BANDS) {
      const { ceiling } = BAND_RANGES[band];
      for (const level of DIFFICULTY_LEVELS) {
        for (let index = 0; index < SWEEP; index += 1) {
          const problem = generateJumpProblem("within-place", band, level, index);
          expect(
            regroups(problem, ceiling),
            `${band} L${String(level)}: ${String(problem.start)} ${problem.operation === "add" ? "+" : "-"} ${String(problem.change)} should not regroup`,
          ).toBe(false);
        }
      }
    }
  });

  it("always regroups on a cross-place jump", () => {
    for (const band of BANDS) {
      const { ceiling } = BAND_RANGES[band];
      for (const level of DIFFICULTY_LEVELS) {
        for (let index = 0; index < SWEEP; index += 1) {
          const problem = generateJumpProblem("cross-place", band, level, index);
          expect(
            regroups(problem, ceiling),
            `${band} L${String(level)}: ${String(problem.start)} ${problem.operation === "add" ? "+" : "-"} ${String(problem.change)} should regroup`,
          ).toBe(true);
        }
      }
    }
  });

  it("still bridges a ten for K-1, where that is the skill being taught", () => {
    for (const level of DIFFICULTY_LEVELS) {
      for (let index = 0; index < SWEEP; index += 1) {
        const problem = generateJumpProblem("cross-place", "k-1", level, index);
        expect(Math.floor(problem.start / 10)).not.toBe(Math.floor(problem.answer / 10));
      }
    }
  });

  it("gives the older bands a jump that uses more than one place, which K-1 never does", () => {
    // The defect this replaced: 2-3's camp 1 was K-1's camp 1 with a bigger
    // number in front, because staying inside a ten caps the jump under ten.
    for (const band of ["2-3", "4-5"] as const) {
      const multiPlace = Array.from({ length: SWEEP }, (_, i) =>
        generateJumpProblem("within-place", band, 5, i),
      ).filter((p) => p.change >= 10);
      expect(multiPlace.length).toBeGreaterThan(0);
    }
    const k1 = Array.from({ length: SWEEP }, (_, i) =>
      generateJumpProblem("within-place", "k-1", 5, i),
    );
    expect(k1.every((p) => p.change < 10)).toBe(true);
  });

  it("sets both adding and subtracting", () => {
    for (const { band, skill, level } of everyCombination()) {
      const operations = new Set(
        Array.from({ length: 40 }, (_, index) =>
          generateJumpProblem(skill, band, level, index).operation,
        ),
      );
      expect(operations).toEqual(new Set(["add", "subtract"]));
    }
  });
});

describe("generateJumpProblem: the line it draws", () => {
  it("always contains both the start and the answer", () => {
    for (const { band, skill, level } of everyCombination()) {
      for (let index = 0; index < SWEEP; index += 1) {
        const { start, answer, line } = generateJumpProblem(skill, band, level, index);
        expect(start).toBeGreaterThanOrEqual(line.min);
        expect(start).toBeLessThanOrEqual(line.max);
        expect(answer).toBeGreaterThanOrEqual(line.min);
        expect(answer).toBeLessThanOrEqual(line.max);
      }
    }
  });

  it("never draws a backwards or degenerate line", () => {
    for (const { band, skill, level } of everyCombination()) {
      for (let index = 0; index < 60; index += 1) {
        const { line } = generateJumpProblem(skill, band, level, index);
        expect(line.max - line.min).toBeGreaterThanOrEqual(10);
        expect(line.min).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("gives K-1 the same fixed line every time, so it becomes familiar", () => {
    for (const skill of SKILLS) {
      for (let index = 0; index < 40; index += 1) {
        expect(generateJumpProblem(skill, "k-1", 3, index).line).toEqual({ min: 0, max: 20 });
      }
    }
  });

  it("keeps a countable number of ticks for the bigger bands", () => {
    for (const band of ["2-3", "4-5"] as const) {
      for (const { skill, level } of everyCombination().filter((c) => c.band === band)) {
        for (let index = 0; index < 60; index += 1) {
          const { line } = generateJumpProblem(skill, band, level, index);
          expect(line.max - line.min).toBeLessThanOrEqual(60);
        }
      }
    }
  });
});

describe("generateJumpProblem: determinism and variety", () => {
  it("gives the same problem for the same four inputs, every time", () => {
    for (const { band, skill, level } of everyCombination()) {
      for (const index of [0, 1, 7, 30]) {
        expect(generateJumpProblem(skill, band, level, index)).toEqual(
          generateJumpProblem(skill, band, level, index),
        );
      }
    }
  });

  it("does not repeat a jump within the lookback window", () => {
    for (const { band, skill, level } of everyCombination()) {
      const sequence = generateJumpSequence(skill, band, level, 120);
      for (let i = 1; i < sequence.length; i += 1) {
        const problem = sequence[i];
        if (problem === undefined) throw new Error("bad sequence");
        for (const earlier of sequence.slice(Math.max(0, i - 3), i)) {
          expect(
            earlier.start === problem.start &&
              earlier.change === problem.change &&
              earlier.operation === problem.operation,
          ).toBe(false);
        }
      }
    }
  });

  it("offers real variety over a sitting, not three problems on repeat", () => {
    for (const { band, skill, level } of everyCombination()) {
      const sequence = generateJumpSequence(skill, band, level, 60);
      const distinct = new Set(
        sequence.map((problem) => `${problem.operation}:${String(problem.start)}+${String(problem.change)}`),
      );
      expect(distinct.size).toBeGreaterThanOrEqual(8);
    }
  });

  it("agrees with the sequence it comes from", () => {
    const sequence = generateJumpSequence("cross-place", "2-3", 4, 25);
    for (let index = 0; index < sequence.length; index += 1) {
      expect(generateJumpProblem("cross-place", "2-3", 4, index)).toEqual(sequence[index]);
    }
  });

  it("returns an empty sequence for a count of zero", () => {
    expect(generateJumpSequence("within-place", "k-1", 1, 0)).toEqual([]);
  });

  it("makes higher levels jump at least as far, on average", () => {
    for (const band of BANDS) {
      for (const skill of SKILLS) {
        const mean = (level: DifficultyLevel) => {
          const sequence = generateJumpSequence(skill, band, level, 120);
          return sequence.reduce((sum, problem) => sum + problem.change, 0) / sequence.length;
        };
        expect(mean(5)).toBeGreaterThan(mean(1));
      }
    }
  });
});
