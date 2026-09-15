import { describe, expect, it } from "vitest";
import {
  evaluateWorkspace,
  reduceGroupingSession,
  startGroupingSession,
  type GroupingSession,
} from "./groupingSession";
import { EMPTY_PLACE_COUNTS, type GroupingTask, type PlaceCounts } from "./grouping";
import { MASTERY_MAX, masteryGain } from "./mastery";
import { STARTING_DIFFICULTY, quickThresholdMs } from "./difficulty";
import type { GradeBand } from "@/lib/domain/onboarding";

const arrayTask: GroupingTask = {
  kind: "array",
  index: 0,
  rows: 3,
  cols: 4,
  stripChoices: [3, 4, 5],
};

const pvTask: GroupingTask = {
  kind: "place-value",
  index: 0,
  target: 34,
  unitChoices: [10, 1],
};

const counts = (partial: Partial<PlaceCounts>): PlaceCounts => ({
  ...EMPTY_PLACE_COUNTS,
  ...partial,
});

describe("evaluateWorkspace: arrays", () => {
  it("says nothing is wrong with an empty frame", () => {
    expect(evaluateWorkspace(arrayTask, { kind: "array", strips: [] })).toEqual({
      kind: "building",
    });
  });

  it("accepts a part-built array as still building", () => {
    expect(evaluateWorkspace(arrayTask, { kind: "array", strips: [4, 4] })).toEqual({
      kind: "building",
    });
  });

  it("solves the array when the rows and columns match", () => {
    expect(evaluateWorkspace(arrayTask, { kind: "array", strips: [4, 4, 4] })).toEqual({
      kind: "solved",
      commuted: false,
    });
  });

  it("accepts the commuted array and says so", () => {
    expect(evaluateWorkspace(arrayTask, { kind: "array", strips: [3, 3, 3, 3] })).toEqual({
      kind: "solved",
      commuted: true,
    });
  });

  it("flags a strip that can be no row of this array at once", () => {
    expect(evaluateWorkspace(arrayTask, { kind: "array", strips: [5] })).toEqual({
      kind: "issue",
      hint: "wrong-strip",
    });
  });

  it("flags uneven rows", () => {
    expect(evaluateWorkspace(arrayTask, { kind: "array", strips: [4, 3] })).toEqual({
      kind: "issue",
      hint: "uneven-rows",
    });
  });

  it("flags an array built past the answer", () => {
    expect(evaluateWorkspace(arrayTask, { kind: "array", strips: [4, 4, 4, 4] })).toEqual({
      kind: "issue",
      hint: "too-many",
    });
  });

  it("solves a square array without calling it commuted", () => {
    const square: GroupingTask = { ...arrayTask, rows: 3, cols: 3, stripChoices: [3] };
    expect(evaluateWorkspace(square, { kind: "array", strips: [3, 3, 3] })).toEqual({
      kind: "solved",
      commuted: false,
    });
  });
});

describe("evaluateWorkspace: place value", () => {
  it("says nothing is wrong with an empty mat", () => {
    expect(evaluateWorkspace(pvTask, { kind: "place-value", counts: EMPTY_PLACE_COUNTS })).toEqual({
      kind: "building",
    });
  });

  it("accepts a mat below the target as still building", () => {
    expect(
      evaluateWorkspace(pvTask, { kind: "place-value", counts: counts({ 10: 2 }) }),
    ).toEqual({ kind: "building" });
  });

  it("solves a properly grouped target", () => {
    expect(
      evaluateWorkspace(pvTask, { kind: "place-value", counts: counts({ 10: 3, 1: 4 }) }),
    ).toEqual({ kind: "solved", commuted: false });
  });

  it("asks for a regroup when the value is right but the blocks are not", () => {
    // 34 built as two tens and fourteen ones is the right number, wrongly grouped.
    expect(
      evaluateWorkspace(pvTask, { kind: "place-value", counts: counts({ 10: 2, 1: 14 }) }),
    ).toEqual({ kind: "issue", hint: "needs-regroup" });
  });

  it("flags going over the target", () => {
    expect(
      evaluateWorkspace(pvTask, { kind: "place-value", counts: counts({ 10: 4 }) }),
    ).toEqual({ kind: "issue", hint: "over-target" });
  });

  it("handles a target with a zero digit", () => {
    const task: GroupingTask = { kind: "place-value", index: 0, target: 105, unitChoices: [100, 10, 1] };
    expect(
      evaluateWorkspace(task, { kind: "place-value", counts: counts({ 100: 1, 1: 5 }) }),
    ).toEqual({ kind: "solved", commuted: false });
  });

  it("treats a mismatched workspace as harmless", () => {
    // Cannot happen through the reducer; asserted so the fallback stays covered.
    expect(evaluateWorkspace(pvTask, { kind: "array", strips: [1] })).toEqual({ kind: "building" });
    expect(
      evaluateWorkspace(arrayTask, { kind: "place-value", counts: EMPTY_PLACE_COUNTS }),
    ).toEqual({ kind: "building" });
  });
});

/* -------------------------------------------------------------------------- */

const BAND: GradeBand = "2-3";
const startArray = (mastery = 0) => startGroupingSession("array", BAND, mastery, 1_000, 0);
const startPv = (mastery = 0) => startGroupingSession("place-value", BAND, mastery, 1_000, 0);
const run = (state: GroupingSession, action: Parameters<typeof reduceGroupingSession>[1], focus: "array" | "place-value" = "array") =>
  reduceGroupingSession(state, action, focus, BAND);

/** Fills the session's array task correctly, one strip at a time. */
function buildArray(state: GroupingSession): GroupingSession {
  if (state.task.kind !== "array") throw new Error("expected an array task");
  const { rows, cols } = state.task;
  let next = state;
  for (let row = 0; row < rows; row += 1) {
    next = run(next, { type: "place-strip", length: cols, now: next.askedAt + 100 });
  }
  return next;
}

/** Fills the session's place-value task correctly. */
function buildPlaceValue(state: GroupingSession): GroupingSession {
  if (state.task.kind !== "place-value") throw new Error("expected a place-value task");
  const { target, unitChoices } = state.task;
  let next = state;
  let left = target;
  for (const unit of unitChoices) {
    const wanted = Math.floor(left / unit);
    left -= wanted * unit;
    for (let i = 0; i < wanted; i += 1) {
      next = run(next, { type: "place-unit", unit, now: next.askedAt + 100 }, "place-value");
    }
  }
  return next;
}

describe("startGroupingSession", () => {
  it("opens with an empty workspace matching its task", () => {
    const state = startArray();
    expect(state.round).toEqual({ kind: "building" });
    expect(state.workspace).toEqual({ kind: "array", strips: [] });
    expect(state.difficulty).toBe(STARTING_DIFFICULTY);
    expect(state.solved).toBe(0);
    expect(state.task.index).toBe(0);
  });

  it("opens a place-value camp on a place-value task", () => {
    expect(startPv().task.kind).toBe("place-value");
    expect(startPv().workspace).toEqual({ kind: "place-value", counts: EMPTY_PLACE_COUNTS });
  });

  it("carries the saved meter in", () => {
    expect(startArray(55).mastery).toBe(55);
  });
});

describe("solving an array task", () => {
  it("pays the meter and counts a clean solve", () => {
    const state = buildArray(startArray());
    expect(state.round).toMatchObject({ kind: "right", note: "clean", gained: masteryGain(0) });
    expect(state.solved).toBe(1);
    expect(state.cleanSolves).toBe(1);
    expect(state.mastery).toBe(masteryGain(0));
  });

  it("stops accepting pieces once solved", () => {
    const solved = buildArray(startArray());
    expect(run(solved, { type: "place-strip", length: 2, now: 9_000 })).toBe(solved);
    expect(run(solved, { type: "remove-strip", at: 0, now: 9_000 })).toBe(solved);
    expect(run(solved, { type: "clear" })).toBe(solved);
  });

  it("never takes the meter past full", () => {
    expect(buildArray(startArray(MASTERY_MAX - 1)).mastery).toBe(MASTERY_MAX);
  });
});

describe("solving a place-value task", () => {
  it("pays the meter and counts a clean solve", () => {
    const state = buildPlaceValue(startPv());
    expect(state.round).toMatchObject({ kind: "right", note: "clean" });
    expect(state.solved).toBe(1);
    expect(state.cleanSolves).toBe(1);
  });

  it("lets a block be taken back off the mat", () => {
    const state = startPv();
    const unit = state.task.kind === "place-value" ? state.task.unitChoices[0] : 10;
    const placed = run(state, { type: "place-unit", unit, now: 1_100 }, "place-value");
    const removed = run(placed, { type: "remove-unit", unit, now: 1_200 }, "place-value");
    expect(removed.workspace).toEqual({ kind: "place-value", counts: EMPTY_PLACE_COUNTS });
  });

  it("ignores removing a block that is not on the mat", () => {
    const state = startPv();
    expect(run(state, { type: "remove-unit", unit: 1, now: 1_100 }, "place-value")).toBe(state);
  });
});

describe("wrong builds", () => {
  it("counts one wrong attempt however many edits keep it wrong", () => {
    let state = startArray();
    const wrongLength = state.task.kind === "array" ? state.task.rows + state.task.cols : 99;
    state = run(state, { type: "place-strip", length: wrongLength, now: 1_100 });
    expect(state.round).toMatchObject({ kind: "issue" });
    expect(state.wrongAttempts).toBe(1);
    const afterSecond = run(state, { type: "place-strip", length: wrongLength, now: 1_200 });
    expect(afterSecond.wrongAttempts).toBe(1);
  });

  it("makes the eventual solve count, but not as clean", () => {
    let state = startArray();
    if (state.task.kind !== "array") throw new Error("expected an array task");
    const bad = state.task.rows === state.task.cols ? state.task.cols + 1 : state.task.rows;
    state = run(state, { type: "place-strip", length: bad, now: 1_100 });
    state = run(state, { type: "clear" });
    state = buildArray(state);
    expect(state.solved).toBe(1);
    expect(state.cleanSolves).toBe(0);
    expect(state.round).toMatchObject({ kind: "right", note: "after-retry" });
  });

  it("clears back to an empty workspace without touching the tallies", () => {
    let state = startArray();
    state = run(state, { type: "place-strip", length: 99, now: 1_100 });
    const cleared = run(state, { type: "clear" });
    expect(cleared.workspace).toEqual({ kind: "array", strips: [] });
    expect(cleared.round).toEqual({ kind: "building" });
    expect(cleared.wrongAttempts).toBe(1);
    expect(cleared.mastery).toBe(state.mastery);
  });

  it("lets a strip be taken back out of the frame", () => {
    let state = startArray();
    const cols = state.task.kind === "array" ? state.task.cols : 3;
    state = run(state, { type: "place-strip", length: cols, now: 1_100 });
    const removed = run(state, { type: "remove-strip", at: 0, now: 1_200 });
    expect(removed.workspace).toEqual({ kind: "array", strips: [] });
  });
});

describe("the reducer's guards", () => {
  it("ignores actions meant for the other mechanic", () => {
    const array = startArray();
    expect(run(array, { type: "place-unit", unit: 10, now: 1_100 })).toBe(array);
    expect(run(array, { type: "remove-unit", unit: 10, now: 1_100 })).toBe(array);
    const pv = startPv();
    expect(run(pv, { type: "place-strip", length: 3, now: 1_100 }, "place-value")).toBe(pv);
    expect(run(pv, { type: "remove-strip", at: 0, now: 1_100 }, "place-value")).toBe(pv);
  });

  it("never mutates the state it is given", () => {
    const state = startArray();
    const snapshot = structuredClone(state);
    buildArray(state);
    expect(state).toEqual(snapshot);
  });
});

describe("moving to the next task", () => {
  it("sets a fresh task and empties the workspace", () => {
    const solved = buildArray(startArray());
    const next = run(solved, { type: "next", now: 5_000 });
    expect(next.task.index).toBe(solved.task.index + 1);
    expect(next.workspace).toEqual({ kind: "array", strips: [] });
    expect(next.round).toEqual({ kind: "building" });
    expect(next.wrongAttempts).toBe(0);
    expect(next.askedAt).toBe(5_000);
    expect(next.solved).toBe(1);
  });
});

describe("difficulty through a grouping sitting", () => {
  it("climbs when every build is quick and right", () => {
    let state = startArray();
    for (let i = 0; i < 8; i += 1) {
      state = run(buildArray(state), { type: "next", now: state.askedAt + 200 });
    }
    expect(state.difficulty).toBe(5);
  });

  it("eases off after a build that was right but slow", () => {
    const state = startArray();
    if (state.task.kind !== "array") throw new Error("expected an array task");
    const late = state.askedAt + quickThresholdMs(state.difficulty) * 4;
    let slow = state;
    for (let row = 0; row < state.task.rows; row += 1) {
      slow = run(slow, { type: "place-strip", length: state.task.cols, now: late });
    }
    expect(slow.difficulty).toBeLessThan(state.difficulty);
    expect(slow.solved).toBe(1);
  });

  it("keeps every invariant across a long mixed run", () => {
    let state = startArray();
    for (let i = 0; i < 40; i += 1) {
      if (i % 3 === 0) {
        state = run(state, { type: "place-strip", length: 99, now: state.askedAt + 50 });
        state = run(state, { type: "clear" });
      }
      state = buildArray(state);
      expect(state.mastery).toBeLessThanOrEqual(MASTERY_MAX);
      expect(state.cleanSolves).toBeLessThanOrEqual(state.solved);
      expect([1, 2, 3, 4, 5]).toContain(state.difficulty);
      state = run(state, { type: "next", now: state.askedAt + 300 });
    }
    expect(state.solved).toBe(40);
    expect(state.mastery).toBe(MASTERY_MAX);
  });
});
