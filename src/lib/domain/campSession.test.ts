import { describe, expect, it } from "vitest";
import { reduceSession, startSession, type CampSession } from "./campSession";
import { STARTING_DIFFICULTY, quickThresholdMs } from "./difficulty";
import { MASTERY_MAX, masteryGain } from "./mastery";
import type { GradeBand } from "@/lib/domain/onboarding";
import { SLIP_MEMORY } from "./slips";

const SKILL = "within-place" as const;
const BAND: GradeBand = "2-3";
const start = (mastery = 0) => startSession(SKILL, BAND, mastery, 1_000, 0);
const run = (state: CampSession, action: Parameters<typeof reduceSession>[1]) =>
  reduceSession(state, action, SKILL, BAND);

/** Lands on the right answer, quickly enough to count as quick. */
function solve(state: CampSession): CampSession {
  return run(state, { type: "land", value: state.problem.answer, at: state.askedAt + 100 });
}

describe("startSession", () => {
  it("opens on an unanswered problem at the starting level", () => {
    const state = start();
    expect(state.round).toEqual({ kind: "awaiting" });
    expect(state.difficulty).toBe(STARTING_DIFFICULTY);
    expect(state.solved).toBe(0);
    expect(state.cleanSolves).toBe(0);
    expect(state.wrongAttempts).toBe(0);
    expect(state.problem.index).toBe(0);
  });

  it("carries the saved meter in rather than starting it over", () => {
    expect(start(42).mastery).toBe(42);
  });

  it("takes the clock from its caller", () => {
    expect(start().askedAt).toBe(1_000);
  });
});

describe("landing on the right answer", () => {
  it("records the solve, pays the meter and says what was gained", () => {
    const state = solve(start());
    expect(state.round).toMatchObject({ kind: "right", gained: masteryGain(0) });
    expect(state.solved).toBe(1);
    expect(state.cleanSolves).toBe(1);
    expect(state.mastery).toBe(masteryGain(0));
  });

  it("counts a solve found after a wobble, but not as clean", () => {
    const wrong = run(start(), { type: "land", value: -999, at: 1_100 });
    // The wrong landing has to be acknowledged before another is accepted,
    // which is what the retry button does.
    const retried = run(wrong, { type: "retry" });
    const state = run(retried, { type: "land", value: retried.problem.answer, at: 1_200 });
    expect(state.solved).toBe(1);
    expect(state.cleanSolves).toBe(0);
    expect(state.round).toMatchObject({ kind: "right", gained: masteryGain(1) });
  });

  it("never takes the meter past full", () => {
    const state = solve(start(MASTERY_MAX - 1));
    expect(state.mastery).toBe(MASTERY_MAX);
  });
});

describe("landing on the wrong answer", () => {
  it("counts the attempt without touching the meter or the solve count", () => {
    const state = run(start(30), { type: "land", value: -1, at: 1_100 });
    expect(state.round).toEqual({ kind: "wrong", landed: -1 });
    expect(state.wrongAttempts).toBe(1);
    expect(state.mastery).toBe(30);
    expect(state.solved).toBe(0);
  });

  it("keeps the same problem so the child can try again", () => {
    const first = start();
    const wrong = run(first, { type: "land", value: -1, at: 1_100 });
    expect(wrong.problem).toEqual(first.problem);
  });

  it("lets retry clear the wrong landing", () => {
    const wrong = run(start(), { type: "land", value: -1, at: 1_100 });
    const retried = run(wrong, { type: "retry" });
    expect(retried.round).toEqual({ kind: "awaiting" });
    // The attempt is remembered, so the eventual solve is not counted clean.
    expect(retried.wrongAttempts).toBe(1);
  });
});

describe("the reducer's guards", () => {
  it("ignores a second landing once the jump is resolved", () => {
    const solved = solve(start());
    expect(run(solved, { type: "land", value: 0, at: 9_999 })).toBe(solved);
  });

  it("ignores retry unless there is a wrong landing to clear", () => {
    const fresh = start();
    expect(run(fresh, { type: "retry" })).toBe(fresh);
    const solved = solve(fresh);
    expect(run(solved, { type: "retry" })).toBe(solved);
  });

  it("is pure: the same state and action give the same result", () => {
    const state = start();
    const action = { type: "land", value: state.problem.answer, at: 1_100 } as const;
    expect(run(state, action)).toEqual(run(state, action));
  });

  it("never mutates the state it is given", () => {
    const state = start();
    const snapshot = structuredClone(state);
    solve(state);
    expect(state).toEqual(snapshot);
  });
});

describe("moving to the next problem", () => {
  it("sets a fresh problem, clears the round and resets the wobble count", () => {
    const solved = solve(start());
    const next = run(solved, { type: "next", at: 5_000 });
    expect(next.round).toEqual({ kind: "awaiting" });
    expect(next.wrongAttempts).toBe(0);
    expect(next.askedAt).toBe(5_000);
    expect(next.problem.index).toBe(solved.problem.index + 1);
  });

  it("keeps the meter and the tallies across problems", () => {
    const solved = solve(start());
    const next = run(solved, { type: "next", at: 5_000 });
    expect(next.mastery).toBe(solved.mastery);
    expect(next.solved).toBe(1);
    expect(next.cleanSolves).toBe(1);
  });
});

describe("difficulty through a whole sitting", () => {
  it("climbs when every answer is quick and right", () => {
    let state = start();
    for (let i = 0; i < 8; i += 1) {
      state = run(solve(state), { type: "next", at: state.askedAt + 200 });
    }
    expect(state.difficulty).toBe(5);
  });

  it("falls back when every answer is wrong", () => {
    let state = start();
    for (let i = 0; i < 8; i += 1) {
      const wrong = run(state, { type: "land", value: -1, at: state.askedAt + 100 });
      state = run(run(wrong, { type: "retry" }), { type: "next", at: wrong.askedAt + 200 });
    }
    expect(state.difficulty).toBe(1);
  });

  it("eases off after a right answer that took a long time", () => {
    const state = start();
    const slow = run(state, {
      type: "land",
      value: state.problem.answer,
      at: state.askedAt + quickThresholdMs(state.difficulty) * 4,
    });
    expect(slow.difficulty).toBeLessThan(state.difficulty);
    // ...and the solve still counts in full.
    expect(slow.solved).toBe(1);
    expect(slow.cleanSolves).toBe(1);
  });

  it("treats a clock that runs backwards as no time at all", () => {
    const state = start();
    const landed = run(state, { type: "land", value: state.problem.answer, at: 0 });
    expect(landed.difficulty).toBe(nextUp(state.difficulty));
  });
});

/** The level one rung up, clamped — used to assert the backwards-clock case. */
function nextUp(level: number): number {
  return Math.min(5, level + 1);
}

describe("a full sitting", () => {
  it("keeps every invariant across a long mixed run", () => {
    let state = start();
    for (let i = 0; i < 60; i += 1) {
      const missFirst = i % 3 === 0;
      if (missFirst) {
        state = run(state, { type: "land", value: state.problem.answer + 1, at: state.askedAt + 50 });
        state = run(state, { type: "retry" });
      }
      state = solve(state);
      expect(state.mastery).toBeLessThanOrEqual(MASTERY_MAX);
      expect(state.cleanSolves).toBeLessThanOrEqual(state.solved);
      expect([1, 2, 3, 4, 5]).toContain(state.difficulty);
      state = run(state, { type: "next", at: state.askedAt + 300 });
    }
    expect(state.solved).toBe(60);
    expect(state.cleanSolves).toBe(40);
    expect(state.mastery).toBe(MASTERY_MAX);
  });
});

describe("the sitting remembers its slips", () => {
  it("starts with none", () => {
    expect(startSession(SKILL, BAND, 0, 1_000, 0).slips).toEqual([]);
  });

  it("records the diagnosis of each wrong landing, oldest first", () => {
    let session = startSession(SKILL, BAND, 0, 1_000, 0);
    const { problem } = session;
    // A tap on the start, then one tick out: two different, nameable slips.
    session = reduceSession(session, { type: "land", value: problem.start, at: 2_000 }, SKILL, BAND);
    session = reduceSession(session, { type: "retry" }, SKILL, BAND);
    session = reduceSession(session, { type: "land", value: problem.answer - 1, at: 3_000 }, SKILL, BAND);
    expect(session.slips).toEqual(["did-not-move", "off-by-one"]);
  });

  it("keeps a right answer out of the list", () => {
    let session = startSession(SKILL, BAND, 0, 1_000, 0);
    session = reduceSession(
      session,
      { type: "land", value: session.problem.answer, at: 2_000 },
      SKILL,
      BAND,
    );
    expect(session.slips).toEqual([]);
  });

  it("never grows without bound, however long the sitting", () => {
    let session = startSession(SKILL, BAND, 0, 1_000, 0);
    for (let i = 0; i < SLIP_MEMORY * 3; i += 1) {
      session = reduceSession(
        session,
        { type: "land", value: session.problem.start, at: 2_000 + i },
        SKILL,
        BAND,
      );
      session = reduceSession(session, { type: "retry" }, SKILL, BAND);
    }
    expect(session.slips).toHaveLength(SLIP_MEMORY);
  });

  it("carries the slips across to the next problem, since the sitting is the unit", () => {
    let session = startSession(SKILL, BAND, 0, 1_000, 0);
    session = reduceSession(session, { type: "land", value: session.problem.start, at: 2_000 }, SKILL, BAND);
    session = reduceSession(session, { type: "retry" }, SKILL, BAND);
    session = reduceSession(session, { type: "land", value: session.problem.answer, at: 3_000 }, SKILL, BAND);
    session = reduceSession(session, { type: "next", at: 4_000 }, SKILL, BAND);
    expect(session.slips).toEqual(["did-not-move"]);
  });
});
