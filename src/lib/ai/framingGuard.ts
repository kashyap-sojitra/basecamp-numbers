import type { FramingRequest } from "./types";

/**
 * The guard that keeps arithmetic out of the model's hands. Pure and
 * standalone: the model may phrase a question, but it cannot answer it, change
 * the numbers, or add new ones — and this is where that is enforced.
 */

/**
 * The answer, computed here rather than trusted from anywhere. This is the
 * only arithmetic anywhere near the AI layer, and it exists purely so the
 * model's words can be checked against it.
 */
export function expectedAnswer(request: FramingRequest): number {
  switch (request.kind) {
    case "jump":
      return request.operation === "add"
        ? request.start + request.change
        : request.start - request.change;
    case "array":
      return request.rows * request.cols;
    case "place-value":
    case "trade-up":
      return request.target;
  }
}

/** The numbers a framing is allowed — and required — to mention. */
export function requiredNumbers(request: FramingRequest): readonly number[] {
  switch (request.kind) {
    case "jump":
      return [request.start, request.change];
    case "array":
      return [request.rows, request.cols];
    case "place-value":
      return [request.target];
    case "trade-up":
      // The counts the story tells; an empty place is not mentioned.
      return request.piles.filter((pile) => pile.count > 0).map((pile) => pile.count);
  }
}

/** Every standalone integer in a piece of text. */
function numbersIn(text: string): readonly number[] {
  return [...text.matchAll(/\d+/g)]
    .map((match) => Number.parseInt(match[0], 10))
    .filter((value) => Number.isFinite(value));
}

export type FramingCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

/** Checks a written framing against the problem it is supposed to describe. */
export function checkFraming(
  request: FramingRequest,
  story: string,
  question: string,
): FramingCheck {
  const text = `${story} ${question}`;
  const seen = numbersIn(text);
  const required = requiredNumbers(request);
  const answer = expectedAnswer(request);

  for (const value of required) {
    if (!seen.includes(value)) {
      return { ok: false, reason: `missing the number ${String(value)}` };
    }
  }

  // Giving the answer away is only detectable when the answer is not itself an
  // operand (0 + 5 = 5, say), so that case is skipped rather than rejecting a
  // perfectly good story.
  // For place-value the target *is* the operand, so it is allowed. Trade-up
  // is the opposite: the counts are the operands and the value is the answer
  // the child has to find, so a story that says it is thrown away.
  const answerIsOperand = request.kind === "place-value";
  if (!answerIsOperand && !required.includes(answer) && seen.includes(answer)) {
    return { ok: false, reason: `gives the answer (${String(answer)}) away` };
  }

  const allowed = new Set<number>([
    ...required,
    ...(answerIsOperand ? [answer] : []),
  ]);
  for (const value of seen) {
    if (!allowed.has(value)) {
      return { ok: false, reason: `invented the number ${String(value)}` };
    }
  }

  if (/[*_#`|<>{}]/.test(text)) return { ok: false, reason: "contains markup" };
  return { ok: true };
}
