import { BAND_RANGES, type JumpProblem } from "@/lib/domain/numberLine";
import type { GradeBand } from "@/lib/domain/onboarding";
import { createRng, hashSeed } from "@/lib/math/rng";

/** How many landings a child chooses between at camp 2. */
export const JUMP_CHOICES = 4;

/**
 * Four landings to choose between: the right one, and three that each *embody*
 * a misconception rather than being noise.
 *
 * This matters more than it looks. `diagnoseJump` reads the tick a child landed
 * on and names the slip — wrong direction, off by one, never moved, missed the
 * regroup — and the reducer already hands that name to the coach. So a wrong
 * pick here produces a real diagnosis and a real hint, exactly as a wrong tap
 * on the number line does. Random distractors would have thrown that away and
 * left the coach with "they got it wrong".
 */
export function jumpChoices(problem: JumpProblem, band: GradeBand): readonly number[] {
  const { start, change, answer, operation, line } = problem;
  const unit = BAND_RANGES[band].unit;
  const back = operation === "add" ? start - change : start + change;

  /*
   * Ordered by how instructive the mistake is, and taken until there are
   * enough. The regroup one is first because it is camp 2's whole skill: a
   * child who adds 38 + 25 and forgets to carry lands on 53, not 63.
   */
  const wrong = [
    operation === "add" ? answer - unit : answer + unit,
    back,
    answer + 1,
    answer - 1,
    start,
    answer + 2,
    answer - 2,
    answer + unit,
    answer - unit,
  ];

  const inRange = (value: number) => value >= line.min && value <= line.max && value >= 0;

  const picked: number[] = [answer];
  for (const candidate of wrong) {
    if (picked.length === JUMP_CHOICES) break;
    if (inRange(candidate) && !picked.includes(candidate)) picked.push(candidate);
  }

  // A line so short that the instructive wrong answers do not fit: fill from
  // the line itself rather than offering fewer than four.
  for (let step = 1; picked.length < JUMP_CHOICES && step <= line.max - line.min; step += 1) {
    for (const candidate of [answer + step, answer - step]) {
      if (picked.length === JUMP_CHOICES) break;
      if (inRange(candidate) && !picked.includes(candidate)) picked.push(candidate);
    }
  }

  // Shuffled deterministically, so the answer is not always in the same place
  // but the same problem always offers the same board.
  const rng = createRng(hashSeed(`choices:${band}:${String(problem.index)}:${String(answer)}`));
  const order = [...picked];
  for (let at = order.length - 1; at > 0; at -= 1) {
    const swap = rng.int(0, at);
    const held = order[at];
    const other = order[swap];
    if (held === undefined || other === undefined) continue;
    order[at] = other;
    order[swap] = held;
  }
  return order;
}
