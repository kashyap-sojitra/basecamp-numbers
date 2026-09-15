import type { GroupingFocus, Mastery } from "@/lib/domain/camp";
import type { GroupingTask, PlaceUnit, Workspace } from "@/lib/domain/grouping";
import { emptyWorkspace, placeCountsValue } from "@/lib/domain/grouping";
import {
  STARTING_DIFFICULTY,
  nextDifficulty,
  type DifficultyLevel,
} from "@/lib/domain/difficulty";
import { addMastery, masteryGain } from "@/lib/domain/mastery";
import type { GradeBand } from "@/lib/domain/onboarding";
import { expectedBlocks, generateGroupingTask } from "@/lib/math/groupingTasks";
import { rememberSlip } from "@/lib/domain/slips";

/** What to say when a build is not right yet. Never a scolding. */
export type GroupingHint =
  | "wrong-strip"
  | "uneven-rows"
  | "too-many"
  | "over-target"
  | "needs-regroup";

export type Evaluation =
  | { readonly kind: "building" }
  | { readonly kind: "solved"; readonly commuted: boolean }
  | { readonly kind: "issue"; readonly hint: GroupingHint };

/** Reads a workspace against its task. Pure — the whole check lives here. */
export function evaluateWorkspace(task: GroupingTask, workspace: Workspace): Evaluation {
  if (task.kind === "array" && workspace.kind === "array") {
    const { strips } = workspace;
    const [first] = strips;
    if (first === undefined) return { kind: "building" };

    // Say so at once when a strip cannot be a row of this array, rather than
    // letting the child stack six of them before anything is said.
    if (strips.some((length) => length !== task.cols && length !== task.rows)) {
      return { kind: "issue", hint: "wrong-strip" };
    }
    if (strips.some((length) => length !== first)) return { kind: "issue", hint: "uneven-rows" };

    const rowCount = strips.length;

    if (rowCount === task.rows && first === task.cols) {
      return { kind: "solved", commuted: false };
    }
    // Rows and columns swapped still makes the same array — worth celebrating.
    if (rowCount === task.cols && first === task.rows) {
      return { kind: "solved", commuted: true };
    }
    if (rowCount * first > task.rows * task.cols) return { kind: "issue", hint: "too-many" };
    return { kind: "building" };
  }

  if (task.kind === "place-value" && workspace.kind === "place-value") {
    const value = placeCountsValue(workspace.counts);
    if (value === 0) return { kind: "building" };
    if (value > task.target) return { kind: "issue", hint: "over-target" };
    if (value < task.target) return { kind: "building" };

    const topUnit = task.unitChoices[0];
    const grouped = task.unitChoices.every(
      (unit) => workspace.counts[unit] === expectedBlocks(task.target, unit, topUnit),
    );
    return grouped ? { kind: "solved", commuted: false } : { kind: "issue", hint: "needs-regroup" };
  }

  // A workspace is always created from its task, so the shapes cannot diverge.
  return { kind: "building" };
}

export type GroupingRound =
  | { readonly kind: "building" }
  | { readonly kind: "issue"; readonly hint: GroupingHint }
  | {
      readonly kind: "right";
      readonly gained: number;
      readonly note: "clean" | "commuted" | "after-retry";
    };

export interface GroupingSession {
  readonly task: GroupingTask;
  readonly workspace: Workspace;
  readonly round: GroupingRound;
  readonly wrongAttempts: number;
  readonly mastery: Mastery;
  readonly solved: number;
  /** Of those, how many were right first time — the star rule reads this. */
  readonly cleanSolves: number;
  /** The level the current task was set at. */
  readonly difficulty: DifficultyLevel;
  /** When the current task appeared, for the adaptive rule's clock. */
  readonly askedAt: number;
  /**
   * The slips made in this sitting, oldest first, capped at `SLIP_MEMORY`.
   * The evaluator's own hint *is* the diagnosis here — "needs-regroup" and
   * "uneven-rows" already name the misconception — so it is recorded as-is and
   * read by the summary line the same way the number line's slips are.
   */
  readonly slips: readonly GroupingHint[];
}

/**
 * Actions carry the clock reading (`now`) rather than the reducer calling
 * `Date.now()`, which keeps it a pure function of its inputs. `at` on the
 * remove actions is a position, not a time — hence the separate `now`.
 */
export type GroupingAction =
  | { readonly type: "place-strip"; readonly length: number; readonly now: number }
  | { readonly type: "remove-strip"; readonly at: number; readonly now: number }
  | { readonly type: "place-unit"; readonly unit: PlaceUnit; readonly now: number }
  | { readonly type: "remove-unit"; readonly unit: PlaceUnit; readonly now: number }
  | { readonly type: "clear" }
  | { readonly type: "next"; readonly now: number };

export function startGroupingSession(
  focus: GroupingFocus,
  band: GradeBand,
  mastery: Mastery,
  now: number,
  /** Where on the ladder this sitting begins — see `ladderStart`. */
  startIndex: number,
): GroupingSession {
  const task = generateGroupingTask(focus, band, STARTING_DIFFICULTY, startIndex);
  return {
    task,
    workspace: emptyWorkspace(task),
    round: { kind: "building" },
    wrongAttempts: 0,
    mastery,
    solved: 0,
    cleanSolves: 0,
    difficulty: STARTING_DIFFICULTY,
    askedAt: now,
    slips: [],
  };
}

/** Applies the evaluation of a freshly changed workspace to the session. */
function settle(state: GroupingSession, workspace: Workspace, now: number): GroupingSession {
  const evaluation = evaluateWorkspace(state.task, workspace);
  const elapsedMs = Math.max(0, now - state.askedAt);

  switch (evaluation.kind) {
    case "building":
      return { ...state, workspace, round: { kind: "building" } };
    case "issue": {
      // A build that stays wrong across edits counts once, not once per tap,
      // and only that first wrong reading moves the difficulty.
      const firstIssue = state.round.kind !== "issue";
      return {
        ...state,
        workspace,
        round: { kind: "issue", hint: evaluation.hint },
        wrongAttempts: firstIssue ? state.wrongAttempts + 1 : state.wrongAttempts,
        difficulty: firstIssue
          ? nextDifficulty(state.difficulty, { correct: false, elapsedMs })
          : state.difficulty,
        // Recorded on the same terms as the wrong-attempt count: once per wrong
        // build, not once per tap while it stays wrong.
        slips: firstIssue ? rememberSlip(state.slips, evaluation.hint) : state.slips,
      };
    }
    case "solved": {
      const gained = masteryGain(state.wrongAttempts);
      const note = evaluation.commuted
        ? "commuted"
        : state.wrongAttempts === 0
          ? "clean"
          : "after-retry";
      return {
        ...state,
        workspace,
        round: { kind: "right", gained, note },
        mastery: addMastery(state.mastery, gained),
        solved: state.solved + 1,
        cleanSolves: state.cleanSolves + (state.wrongAttempts === 0 ? 1 : 0),
        difficulty: nextDifficulty(state.difficulty, { correct: true, elapsedMs }),
      };
    }
  }
}

export function reduceGroupingSession(
  state: GroupingSession,
  action: GroupingAction,
  focus: GroupingFocus,
  band: GradeBand,
): GroupingSession {
  if (action.type === "next") {
    const task = generateGroupingTask(focus, band, state.difficulty, state.task.index + 1, state.task);
    return {
      ...state,
      task,
      workspace: emptyWorkspace(task),
      round: { kind: "building" },
      wrongAttempts: 0,
      askedAt: action.now,
    };
  }

  // Once a task is solved it stays solved; stray pieces change nothing.
  if (state.round.kind === "right") return state;

  const { workspace } = state;

  switch (action.type) {
    case "place-strip":
      if (workspace.kind !== "array") return state;
      return settle(
        state,
        { kind: "array", strips: [...workspace.strips, action.length] },
        action.now,
      );

    case "remove-strip": {
      if (workspace.kind !== "array") return state;
      const strips = workspace.strips.filter((_, index) => index !== action.at);
      return settle(state, { kind: "array", strips }, action.now);
    }

    case "place-unit": {
      if (workspace.kind !== "place-value") return state;
      const counts = {
        ...workspace.counts,
        [action.unit]: workspace.counts[action.unit] + 1,
      };
      return settle(state, { kind: "place-value", counts }, action.now);
    }

    case "remove-unit": {
      if (workspace.kind !== "place-value") return state;
      if (workspace.counts[action.unit] === 0) return state;
      const counts = {
        ...workspace.counts,
        [action.unit]: workspace.counts[action.unit] - 1,
      };
      return settle(state, { kind: "place-value", counts }, action.now);
    }

    case "clear":
      return {
        ...state,
        workspace: emptyWorkspace(state.task),
        round: { kind: "building" },
      };
  }
}
