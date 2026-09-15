import type { JumpProblem } from "@/lib/domain/numberLine";

/**
 * What went wrong, read off the tick the child actually landed on.
 *
 * The rule decides, the model only finds the words: diagnosing a misconception
 * is arithmetic and belongs here, while wording it warmly is the coach's job.
 * Every nudge also stands on its own, because the model may be absent,
 * throttled or refused at any moment.
 */

export type JumpMisconception =
  /** Landed back where they started — a tap, not a jump. */
  | "did-not-move"
  /** Jumped the right distance the wrong way: added instead of subtracting. */
  | "wrong-direction"
  /** One tick out, which is nearly always counting the starting tick. */
  | "off-by-one"
  /** Stopped on the ten (or hundred) instead of carrying on past it. */
  | "stopped-at-the-boundary"
  /** Right within the place, but the carry or borrow never happened. */
  | "missed-the-regroup"
  /** None of the above: a genuine miscount. */
  | "miscounted";

export interface JumpDiagnosis {
  readonly kind: JumpMisconception;
  /**
   * A nudge in the child's own terms. **Never contains the answer**, and never
   * the distance that would give it away — a test sweeps every problem and
   * every wrong landing to hold that.
   */
  readonly nudge: string;
}

/**
 * THE DIAGNOSIS RULE. Ordered most-specific first: a landing can satisfy more
 * than one description, and the most specific one is the most useful thing to
 * say.
 */
export function diagnoseJump(problem: JumpProblem, landed: number): JumpDiagnosis {
  const forward = problem.operation === "add";
  const travelled = landed - problem.start;
  const wanted = problem.answer - problem.start;

  if (landed === problem.start) {
    return {
      kind: "did-not-move",
      nudge: forward
        ? "You are still on the starting number. Count forward from there."
        : "You are still on the starting number. Count back from there.",
    };
  }

  // The right distance, travelled the wrong way.
  if (travelled === -wanted) {
    return {
      kind: "wrong-direction",
      nudge: forward
        ? "That was the right size of jump, but it went backwards. Adding moves forward."
        : "That was the right size of jump, but it went forwards. Taking away moves back.",
    };
  }

  if (Math.abs(landed - problem.answer) === 1) {
    return {
      kind: "off-by-one",
      nudge:
        "So close — one tick out. The number you start on is not the first hop; the next one is.",
    };
  }

  // A carry or borrow that did not happen lands exactly one place away.
  const place = problem.line.max > 100 ? 100 : 10;
  if (Math.abs(landed - problem.answer) === place) {
    return {
      kind: "missed-the-regroup",
      nudge: forward
        ? "Check the trade: once a place fills up, the one above it grows by one."
        : "Check the trade: when a place runs short, borrow one from the place above.",
    };
  }

  // Pulled up short on the round number between the two ends.
  const between = landed > Math.min(problem.start, problem.answer) && landed < Math.max(problem.start, problem.answer);
  if (between && landed % place === 0) {
    return {
      kind: "stopped-at-the-boundary",
      nudge: "You stopped on the round number. There are still hops left to use.",
    };
  }

  return {
    kind: "miscounted",
    nudge: forward
      ? "Try counting the hops out loud, one tick at a time, going forward."
      : "Try counting the hops out loud, one tick at a time, going back.",
  };
}
