import type { JumpProblem } from "@/lib/domain/numberLine";
import type { GroupingHint } from "@/lib/domain/groupingSession";
import { TRADE_AT } from "@/lib/domain/grouping";

/**
 * THE REACTION RULE: what the stamp over the board says after an answer.
 *
 * A right answer is always YAY. A wrong one used to be "Nearly!" whatever had
 * happened, which a child can catch out: land ten ticks from the answer, or
 * jump the wrong way entirely, and "nearly" is a fib. The stamp now says how
 * far off the answer *was* where that can be measured, and something honest
 * where it cannot. Still never a cross, a red, or a sad face — every word
 * here is an invitation to go again.
 */

export type MissTone =
  /** One tick out. Nearly always counting the starting tick. */
  | "close"
  /** Off, but by less than the jump itself. */
  | "off"
  /** As far off as the jump or further: no jump, or the wrong direction. */
  | "far"
  /** More pieces than the number needs. */
  | "too-many"
  /** Not measurable as a distance: a row that does not fit, a mat with the wrong shape. */
  | "not-yet";

export type Reaction =
  | { readonly kind: "yay" }
  | { readonly kind: "miss"; readonly tone: MissTone };

export const YAY: Reaction = { kind: "yay" };

/** What the stamp reads. Short, concrete words a K-1 reader can decode. */
export const YAY_WORD = "YAY!";
export const MISS_WORDS: Record<MissTone, string> = {
  close: "So close!",
  off: "Not quite!",
  far: "Try again!",
  "too-many": "Too many!",
  "not-yet": "Not yet!",
};

/** Within this many ticks counts as close. */
export const CLOSE_TICKS = 1;

/**
 * A wrong landing on the number line, or a wrong pick of a landing: how far
 * it was from the answer, measured against the size of the jump asked for.
 * Landing where you started is `change` away; jumping the wrong way is twice
 * that. Neither is anywhere near.
 */
export function jumpMiss(problem: JumpProblem, landed: number): Reaction {
  const distance = Math.abs(landed - problem.answer);
  if (distance <= CLOSE_TICKS) return { kind: "miss", tone: "close" };
  if (distance < problem.change) return { kind: "miss", tone: "off" };
  return { kind: "miss", tone: "far" };
}

/**
 * A wrong array or mat. The evaluator's hint already says what kind of wrong;
 * only "more than the number" has a direction the stamp can honestly name.
 */
export function groupingMiss(hint: GroupingHint): Reaction {
  return hint === "too-many" || hint === "over-target"
    ? { kind: "miss", tone: "too-many" }
    : { kind: "miss", tone: "not-yet" };
}

/**
 * A wrong number typed for the mat at the summit: how far from its value it
 * was. One away is close; within a ten is off; anything else — the counts
 * written side by side, one place on its own — is far, and the stamp says so
 * honestly rather than calling `714` nearly `84`.
 */
export function tradeMiss(answer: number, target: number): Reaction {
  const distance = Math.abs(answer - target);
  if (distance <= CLOSE_TICKS) return { kind: "miss", tone: "close" };
  if (distance < TRADE_AT) return { kind: "miss", tone: "off" };
  return { kind: "miss", tone: "far" };
}

/** The word for a reaction, for the stamp and for the tests that read it. */
export function reactionWord(reaction: Reaction): string {
  return reaction.kind === "yay" ? YAY_WORD : MISS_WORDS[reaction.tone];
}
