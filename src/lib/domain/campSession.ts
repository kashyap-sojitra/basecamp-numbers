import type { JumpSkill, Mastery } from "@/lib/domain/camp";
import {
  STARTING_DIFFICULTY,
  nextDifficulty,
  type DifficultyLevel,
} from "@/lib/domain/difficulty";
import { addMastery, masteryGain } from "@/lib/domain/mastery";
import type { JumpProblem } from "@/lib/domain/numberLine";
import type { GradeBand } from "@/lib/domain/onboarding";
import { generateJumpProblem } from "@/lib/math/numberLineProblems";
import { diagnoseJump, type JumpMisconception } from "@/lib/domain/jumpDiagnosis";
import { rememberSlip } from "@/lib/domain/slips";

/** Where the current jump stands. */
export type Round =
  | { readonly kind: "awaiting" }
  | { readonly kind: "wrong"; readonly landed: number }
  | { readonly kind: "right"; readonly landed: number; readonly gained: number };

/** One sitting at a number-line camp. Lives in React state only, for now. */
export interface CampSession {
  readonly problem: JumpProblem;
  readonly round: Round;
  /** Wrong landings on the current problem. */
  readonly wrongAttempts: number;
  readonly mastery: Mastery;
  readonly solved: number;
  /** Of those, how many were right first time — the star rule reads this. */
  readonly cleanSolves: number;
  /** The level the current problem was set at. */
  readonly difficulty: DifficultyLevel;
  /** When the current problem appeared, for the adaptive rule's clock. */
  readonly askedAt: number;
  /**
   * The slips made in this sitting, oldest first, capped at `SLIP_MEMORY`.
   *
   * Kept so the summary line can say what the child *got better at* rather
   * than only how the sitting went overall. A four-way "strong / steady /
   * wobbly / nothing" cannot tell a child they stopped counting the starting
   * tick; a list of diagnoses can.
   */
  readonly slips: readonly JumpMisconception[];
}

/**
 * Actions carry the clock reading rather than the reducer calling `Date.now()`,
 * which keeps it a pure function of its inputs.
 */
export type CampSessionAction =
  | { readonly type: "land"; readonly value: number; readonly at: number }
  | { readonly type: "retry" }
  | { readonly type: "next"; readonly at: number };

export function startSession(
  skill: JumpSkill,
  band: GradeBand,
  mastery: Mastery,
  now: number,
  /** Where on the ladder this sitting begins — see `ladderStart`. */
  startIndex: number,
): CampSession {
  return {
    problem: generateJumpProblem(skill, band, STARTING_DIFFICULTY, startIndex),
    round: { kind: "awaiting" },
    wrongAttempts: 0,
    mastery,
    solved: 0,
    cleanSolves: 0,
    difficulty: STARTING_DIFFICULTY,
    askedAt: now,
    slips: [],
  };
}

export function reduceSession(
  state: CampSession,
  action: CampSessionAction,
  skill: JumpSkill,
  band: GradeBand,
): CampSession {
  switch (action.type) {
    case "land": {
      // Ignore stray landings once the jump is resolved.
      if (state.round.kind !== "awaiting") return state;

      const correct = action.value === state.problem.answer;
      // The level for the next problem is decided the moment this one is
      // resolved, from correctness and how long it took.
      const difficulty = nextDifficulty(state.difficulty, {
        correct,
        elapsedMs: Math.max(0, action.at - state.askedAt),
      });

      if (correct) {
        const gained = masteryGain(state.wrongAttempts);
        return {
          ...state,
          round: { kind: "right", landed: action.value, gained },
          mastery: addMastery(state.mastery, gained),
          solved: state.solved + 1,
          cleanSolves: state.cleanSolves + (state.wrongAttempts === 0 ? 1 : 0),
          difficulty,
        };
      }
      return {
        ...state,
        round: { kind: "wrong", landed: action.value },
        wrongAttempts: state.wrongAttempts + 1,
        difficulty,
        slips: rememberSlip(state.slips, diagnoseJump(state.problem, action.value).kind),
      };
    }
    case "retry":
      return state.round.kind === "wrong" ? { ...state, round: { kind: "awaiting" } } : state;
    case "next":
      return {
        ...state,
        problem: generateJumpProblem(skill, band, state.difficulty, state.problem.index + 1, state.problem),
        round: { kind: "awaiting" },
        wrongAttempts: 0,
        askedAt: action.at,
      };
  }
}
