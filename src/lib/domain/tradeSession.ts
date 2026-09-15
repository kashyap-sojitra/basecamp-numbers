import type { Mastery } from "@/lib/domain/camp";
import {
  STARTING_DIFFICULTY,
  nextDifficulty,
  type DifficultyLevel,
} from "@/lib/domain/difficulty";
import { addMastery, masteryGain } from "@/lib/domain/mastery";
import type { GradeBand } from "@/lib/domain/onboarding";
import { generateTradeTask, type TradeTask } from "@/lib/math/tradeTasks";
import { rememberSlip } from "@/lib/domain/slips";
import { diagnoseTrade, type TradeSlip } from "@/lib/domain/tradeDiagnosis";

export type { TradeSlip } from "@/lib/domain/tradeDiagnosis";

/**
 * Camp 4's sitting: the mat shows a number the long way, and the child works
 * out what it is worth and types it.
 *
 * It used to be tapping "Trade 10" under whichever column had ten, which is
 * the same act as camp 2's pick — choose one of a few buttons — with the right
 * button lit up. Typing the value is an act no other camp asks for, and at
 * the summit it is real work: 2 thousands, 13 hundreds, 1 ten and 15 ones is
 * 3325, and the carries happen in the child's head. The ten-frames on the
 * mat are the support, not the answer.
 */

/** The most digits an answer can need; the ladder tops out below 10 000. */
export const ENTRY_MAX_DIGITS = 5;

/** Where the current mat stands. */
export type TradeRound =
  | { readonly kind: "typing" }
  /** A wrong number was entered, and this is what the slip was. */
  | { readonly kind: "wrong"; readonly answer: number; readonly slip: TradeSlip }
  | { readonly kind: "right"; readonly gained: number };

/** One sitting at the summit. Lives in React state only. */
export interface TradeSession {
  readonly task: TradeTask;
  /** The digits typed so far, as typed. */
  readonly entry: string;
  readonly round: TradeRound;
  readonly wrongAttempts: number;
  readonly mastery: Mastery;
  readonly solved: number;
  readonly cleanSolves: number;
  readonly difficulty: DifficultyLevel;
  readonly askedAt: number;
  /** The slips made this sitting, oldest first, capped at `SLIP_MEMORY`. */
  readonly slips: readonly TradeSlip[];
}

/** Actions carry their own clock reading, so the reducer stays pure. */
export type TradeSessionAction =
  | { readonly type: "digit"; readonly digit: number }
  | { readonly type: "erase" }
  | { readonly type: "submit"; readonly at: number }
  | { readonly type: "clear" }
  | { readonly type: "next"; readonly at: number };

export function startTradeSession(
  band: GradeBand,
  mastery: Mastery,
  now: number,
  /** Where on the ladder this sitting begins — see `ladderStart`. */
  startIndex: number,
): TradeSession {
  const task = generateTradeTask(band, STARTING_DIFFICULTY, startIndex);
  return {
    task,
    entry: "",
    round: { kind: "typing" },
    wrongAttempts: 0,
    mastery,
    solved: 0,
    cleanSolves: 0,
    difficulty: STARTING_DIFFICULTY,
    askedAt: now,
    slips: [],
  };
}

export function reduceTradeSession(
  state: TradeSession,
  action: TradeSessionAction,
  band: GradeBand,
): TradeSession {
  switch (action.type) {
    case "digit": {
      if (state.round.kind !== "typing") return state;
      if (!Number.isInteger(action.digit) || action.digit < 0 || action.digit > 9) return state;
      if (state.entry.length >= ENTRY_MAX_DIGITS) return state;
      // A number never starts with a zero; ignoring it keeps `Number(entry)`
      // and what the child sees the same thing.
      if (state.entry === "" && action.digit === 0) return state;
      return { ...state, entry: `${state.entry}${String(action.digit)}` };
    }
    case "erase":
      if (state.round.kind !== "typing") return state;
      return { ...state, entry: state.entry.slice(0, -1) };
    case "submit": {
      if (state.round.kind !== "typing" || state.entry === "") return state;
      const answer = Number(state.entry);
      const { task } = state;

      if (answer !== task.target) {
        const slip = diagnoseTrade(answer, task.start, task.units, task.target);
        return {
          ...state,
          entry: "",
          round: { kind: "wrong", answer, slip },
          wrongAttempts: state.wrongAttempts + 1,
          slips: rememberSlip(state.slips, slip),
        };
      }

      const gained = masteryGain(state.wrongAttempts);
      return {
        ...state,
        round: { kind: "right", gained },
        mastery: addMastery(state.mastery, gained),
        solved: state.solved + 1,
        cleanSolves: state.cleanSolves + (state.wrongAttempts === 0 ? 1 : 0),
        difficulty: nextDifficulty(state.difficulty, {
          correct: true,
          elapsedMs: Math.max(0, action.at - state.askedAt),
        }),
      };
    }
    case "clear":
      return state.round.kind === "wrong" ? { ...state, round: { kind: "typing" } } : state;
    case "next": {
      if (state.round.kind !== "right") return state;
      const task = generateTradeTask(band, state.difficulty, state.task.index + 1, state.task);
      return {
        ...state,
        task,
        entry: "",
        round: { kind: "typing" },
        wrongAttempts: 0,
        askedAt: action.at,
      };
    }
  }
}
