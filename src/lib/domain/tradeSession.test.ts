import { describe, expect, it } from "vitest";
import { DIFFICULTY_LEVELS } from "@/lib/domain/difficulty";
import { MASTERY_MAX } from "@/lib/domain/mastery";
import { placeCountsValue } from "@/lib/domain/grouping";
import {
  ENTRY_MAX_DIGITS,
  reduceTradeSession,
  startTradeSession,
  type TradeSession,
} from "./tradeSession";
import { SLIP_MEMORY } from "@/lib/domain/slips";

const AT = 1_000;

/** Type a number digit by digit. */
function type(state: TradeSession, value: number | string): TradeSession {
  return String(value)
    .split("")
    .reduce((s, d) => reduceTradeSession(s, { type: "digit", digit: Number(d) }, "2-3"), state);
}

/** Type a number and check it. */
function answer(state: TradeSession, value: number, at = AT): TradeSession {
  return reduceTradeSession(type(state, value), { type: "submit", at }, "2-3");
}

/** The counts the mat shows, written side by side: the classic slip. */
function sideBySide(state: TradeSession): number {
  return Number(state.task.units.map((unit) => String(state.task.start[unit])).join(""));
}

describe("startTradeSession", () => {
  it("opens on a mat written the long way, worth the target, with nothing typed", () => {
    const state = startTradeSession("2-3", 0, AT, 0);
    expect(placeCountsValue(state.task.start)).toBe(state.task.target);
    expect(state.entry).toBe("");
    expect(state.round).toEqual({ kind: "typing" });
    expect(state.solved).toBe(0);
  });
});

describe("reduceTradeSession: typing", () => {
  it("builds the entry digit by digit and erases from the end", () => {
    let state = startTradeSession("2-3", 0, AT, 0);
    state = type(state, 84);
    expect(state.entry).toBe("84");
    state = reduceTradeSession(state, { type: "erase" }, "2-3");
    expect(state.entry).toBe("8");
  });

  it("ignores a leading zero, a digit past the cap, and anything that is not a digit", () => {
    let state = startTradeSession("2-3", 0, AT, 0);
    state = reduceTradeSession(state, { type: "digit", digit: 0 }, "2-3");
    expect(state.entry).toBe("");
    state = type(state, "9".repeat(ENTRY_MAX_DIGITS + 3));
    expect(state.entry).toHaveLength(ENTRY_MAX_DIGITS);
    const before = state;
    state = reduceTradeSession(state, { type: "digit", digit: 12 }, "2-3");
    expect(state).toBe(before);
  });

  it("does nothing on an empty check", () => {
    const state = startTradeSession("2-3", 0, AT, 0);
    expect(reduceTradeSession(state, { type: "submit", at: AT }, "2-3")).toBe(state);
  });
});

describe("reduceTradeSession: answering", () => {
  it("pays the meter and counts the solve for the right number", () => {
    const start = startTradeSession("2-3", 0, AT, 0);
    const state = answer(start, start.task.target);
    expect(state.round.kind).toBe("right");
    expect(state.solved).toBe(1);
    expect(state.cleanSolves).toBe(1);
    expect(state.mastery).toBeGreaterThan(0);
  });

  it("names the slip for a wrong number, clears the entry, and keeps the task", () => {
    const start = startTradeSession("2-3", 0, AT, 0);
    const state = answer(start, sideBySide(start));
    expect(state.round).toEqual({
      kind: "wrong",
      answer: sideBySide(start),
      slip: "places-side-by-side",
    });
    expect(state.entry).toBe("");
    expect(state.wrongAttempts).toBe(1);
    expect(state.slips).toEqual(["places-side-by-side"]);
    expect(state.task).toBe(start.task);
    expect(state.mastery).toBe(0);
  });

  it("pays less for a number found after a wobble", () => {
    const start = startTradeSession("2-3", 0, AT, 0);
    const clean = answer(start, start.task.target);
    let wobbly = answer(start, start.task.target + 1);
    wobbly = reduceTradeSession(wobbly, { type: "clear" }, "2-3");
    wobbly = answer(wobbly, wobbly.task.target);
    expect(wobbly.round.kind).toBe("right");
    expect(wobbly.cleanSolves).toBe(0);
    if (clean.round.kind === "right" && wobbly.round.kind === "right") {
      expect(wobbly.round.gained).toBeLessThan(clean.round.gained);
    }
  });

  it("ignores typing while a hint is up, and until the child clears it", () => {
    const start = startTradeSession("2-3", 0, AT, 0);
    const wrong = answer(start, start.task.target + 1);
    expect(type(wrong, 5).entry).toBe("");
    const cleared = reduceTradeSession(wrong, { type: "clear" }, "2-3");
    expect(cleared.round).toEqual({ kind: "typing" });
    expect(type(cleared, 5).entry).toBe("5");
  });

  it("ignores typing once the number is found, and only moves on from a win", () => {
    const start = startTradeSession("2-3", 0, AT, 0);
    expect(reduceTradeSession(start, { type: "next", at: AT }, "2-3")).toBe(start);
    const won = answer(start, start.task.target);
    expect(type(won, 1).entry).toBe(won.entry);
    const next = reduceTradeSession(won, { type: "next", at: AT + 1 }, "2-3");
    expect(next.task.index).toBe(start.task.index + 1);
    expect(next.entry).toBe("");
    expect(next.round).toEqual({ kind: "typing" });
    expect(next.wrongAttempts).toBe(0);
  });
});

describe("reduceTradeSession: a whole sitting", () => {
  it("keeps every invariant across many tasks", () => {
    let state = startTradeSession("4-5", 0, AT, 0);
    let previous = state.task;
    for (let i = 0; i < 30; i += 1) {
      // Alternate a clean answer and one after a wobble.
      if (i % 2 === 1) {
        state = answer(state, state.task.target + 1, AT + i);
        expect(state.round.kind).toBe("wrong");
        state = reduceTradeSession(state, { type: "clear" }, "4-5");
      }
      state = answer(state, state.task.target, AT + i * 20_000);
      expect(state.round.kind).toBe("right");
      expect(state.mastery).toBeLessThanOrEqual(MASTERY_MAX);
      expect(state.cleanSolves).toBeLessThanOrEqual(state.solved);
      expect(DIFFICULTY_LEVELS).toContain(state.difficulty);
      state = reduceTradeSession(state, { type: "next", at: AT + i * 20_000 + 1 }, "4-5");
      expect(state.task.target).not.toBe(previous.target);
      previous = state.task;
    }
    expect(state.solved).toBe(30);
  });

  it("never mutates the state it was given", () => {
    const start = startTradeSession("2-3", 0, AT, 0);
    const snapshot = JSON.stringify(start);
    answer(start, start.task.target);
    answer(start, 1);
    expect(JSON.stringify(start)).toBe(snapshot);
  });

  it("caps the slips it remembers", () => {
    let state = startTradeSession("2-3", 0, AT, 0);
    for (let i = 0; i < SLIP_MEMORY + 5; i += 1) {
      state = answer(state, state.task.target + 1);
      state = reduceTradeSession(state, { type: "clear" }, "2-3");
    }
    expect(state.slips).toHaveLength(SLIP_MEMORY);
    expect(state.wrongAttempts).toBe(SLIP_MEMORY + 5);
  });
});
