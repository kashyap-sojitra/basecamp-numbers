import type { JumpSkill } from "@/lib/domain/camp";
import { levelBand, type DifficultyLevel } from "@/lib/domain/difficulty";
import type { GradeBand } from "@/lib/domain/onboarding";
import type { JumpOperation, JumpProblem } from "@/lib/domain/numberLine";
import { BAND_RANGES } from "@/lib/domain/numberLine";
import { createRng, hashSeed, type Rng } from "@/lib/math/rng";
import { buildSequence, distinctFrom } from "@/lib/math/sequence";

const OPERATIONS: readonly [JumpOperation, ...JumpOperation[]] = ["add", "subtract"];

/** Where the jump starts and how far it travels, before the line is sized. */
interface JumpShape {
  readonly start: number;
  readonly change: number;
}

/**
 * THE SKILL RULE.
 *
 *   within-place -> no place carries or borrows.  5 + 2,  34 + 25,  623 + 14
 *   cross-place  -> at least one does.            8 + 5,  38 + 25,  899 + 6
 *
 * Regrouping rather than "inside a ten", because staying inside a ten forces
 * the jump under ten and so cannot scale past K-1. Jump size cannot scale
 * either: the line draws one tick per integer, so a jump of 40 is 1632px.
 */

/**
 * The places a band's numbers occupy, largest first. A ceiling of 100 means
 * tens and ones — `unit < ceiling`, not `<=`, or a band would be handed a
 * place above its own ceiling and every start would begin with a 1.
 */
function placesUpTo(ceiling: number): readonly number[] {
  const places: number[] = [];
  for (let unit = 1; unit < ceiling; unit *= 10) places.unshift(unit);
  return places;
}

/** The digit of `value` at `unit`. */
function placeDigit(value: number, unit: number): number {
  return Math.floor(value / unit) % 10;
}

/**
 * Builds a number place by place, keeping it within `cap`.
 *
 * The caller gives each place a legal range of digits — which is where "must
 * not carry" and "must borrow" are expressed. Every place's *minimum* is
 * reserved out of the cap before any higher place is settled, so a place that
 * has to hold a nine (to pass a carry upwards) always has room left for it.
 * Without that reservation a generous hundreds digit could eat the budget and
 * push the answer past the band's ceiling.
 *
 * Construction rather than rejection sampling, so it always terminates.
 */
function buildNumber(
  rng: Rng,
  places: readonly number[],
  cap: number,
  rangeFor: (unit: number) => { readonly lo: number; readonly hi: number },
): number {
  const ranges = places.map((unit) => ({ unit, ...rangeFor(unit) }));

  // What the places *below* each one must still be able to hold.
  const reserved: number[] = [];
  let below = 0;
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    reserved[i] = below;
    const range = ranges[i];
    below += range === undefined ? 0 : range.lo * range.unit;
  }

  let remaining = cap;
  let value = 0;
  for (let i = 0; i < ranges.length; i += 1) {
    const range = ranges[i];
    if (range === undefined) continue;
    const spare = Math.max(0, remaining - (reserved[i] ?? 0));
    const room = Math.floor(spare / range.unit);
    const digit = rng.int(range.lo, Math.max(range.lo, Math.min(range.hi, room)));
    value += digit * range.unit;
    remaining = Math.max(0, remaining - digit * range.unit);
  }
  return value;
}

/** True when adding `change` to `start` carries out of any place. */
export function carriesAdding(start: number, change: number, ceiling: number): boolean {
  let carry = 0;
  for (const unit of [...placesUpTo(ceiling)].reverse()) {
    const sum = placeDigit(start, unit) + placeDigit(change, unit) + carry;
    carry = sum > 9 ? 1 : 0;
    if (carry === 1) return true;
  }
  return false;
}

/** True when subtracting `change` from `start` borrows from any place. */
export function borrowsSubtracting(start: number, change: number, ceiling: number): boolean {
  for (const unit of [...placesUpTo(ceiling)].reverse()) {
    if (placeDigit(start, unit) < placeDigit(change, unit)) return true;
  }
  return false;
}

/**
 * How many places a carry should run through, which is what makes a crossing
 * jump harder without making it longer. `899 + 6` cascades through two;
 * `234 + 18` through one. The band caps it, because a cascade needs places to
 * cascade *into*.
 */
function cascadeFor(ceiling: number, level: DifficultyLevel): number {
  const places = placesUpTo(ceiling).length;
  const most = Math.max(0, places - 2);
  return Math.min(most, Math.floor((level - 1) / 2));
}

/**
 * The smaller of the jump's two ends, built so that adding `change` to it has
 * the wanted carry behaviour. Addition starts there; subtraction starts at the
 * far end and lands on it — `start - change` borrows exactly when
 * `answer + change` carries, so one construction serves both.
 */
function lowerEnd(
  rng: Rng,
  ceiling: number,
  change: number,
  regroup: boolean,
  cascade: number,
): number {
  const places = placesUpTo(ceiling);
  const cap = Math.max(0, ceiling - change);
  const ones = placeDigit(change, 1);
  // Below a hundred a leading zero is the honest answer (K-1 really does add
  // 5 and 2). At or above it, a band should not be handing out single-digit
  // starts on a three-digit camp.
  const topFloor = ceiling >= 100 ? 1 : 0;
  const top = places[0] ?? 1;

  return buildNumber(rng, places, cap, (unit) => {
    const floor = unit === top ? topFloor : 0;
    if (!regroup) {
      // No place may carry, so each digit is bounded by its partner.
      return { lo: floor, hi: Math.max(floor, 9 - placeDigit(change, unit)) };
    }
    if (unit === 1) {
      // The ones must carry. `change` is chosen with a non-zero ones digit, so
      // this range is never empty.
      return { lo: Math.max(10 - ones, 0), hi: 9 };
    }
    // A nine here passes the carry up to the next place.
    const cascading = Math.log10(unit) <= cascade;
    if (cascading) return { lo: 9, hi: 9 };
    return { lo: floor, hi: 9 };
  });
}

function shapeForBand(
  rng: Rng,
  band: GradeBand,
  skill: JumpSkill,
  operation: JumpOperation,
  level: DifficultyLevel,
): JumpShape {
  const range = BAND_RANGES[band];
  const { lo, hi } = levelBand(range.minChange, range.maxChange, level);
  const regroup = skill === "cross-place";

  let change = rng.int(lo, hi);
  // A crossing jump carries out of the ones, which needs a ones digit to carry.
  if (regroup && change % 10 === 0) change = change + 1 <= range.maxChange ? change + 1 : change - 1;

  const cascade = regroup ? cascadeFor(range.ceiling, level) : 0;
  const lower = lowerEnd(rng, range.ceiling, change, regroup, cascade);

  return operation === "add" ? { start: lower, change } : { start: lower + change, change };
}

/** Rounds the drawn window out to friendly multiples of five. */
function lineWindow(
  band: GradeBand,
  start: number,
  answer: number,
): { readonly min: number; readonly max: number } {
  const fixed = BAND_RANGES[band].fixedLine;
  if (fixed !== null) return fixed;

  const lo = Math.min(start, answer);
  const hi = Math.max(start, answer);
  const min = Math.max(0, Math.floor((lo - 3) / 5) * 5);
  const max = Math.max(Math.ceil((hi + 3) / 5) * 5, min + 10);
  return { min, max };
}

function candidate(
  skill: JumpSkill,
  band: GradeBand,
  level: DifficultyLevel,
  index: number,
  salt: number,
): JumpProblem {
  const rng = createRng(
    hashSeed(`number-line:${skill}:${band}:${String(level)}:${String(index)}:${String(salt)}`),
  );
  const operation = rng.pick(OPERATIONS);
  const { start, change } = shapeForBand(rng, band, skill, operation, level);
  const answer = operation === "add" ? start + change : start - change;

  return {
    index,
    operation,
    start,
    change,
    answer,
    line: lineWindow(band, start, answer),
  };
}

function sameJump(a: JumpProblem, b: JumpProblem): boolean {
  return a.start === b.start && a.change === b.change && a.operation === b.operation;
}

/**
 * The first `count` problems for a grade band, in order. Deterministic — the
 * same band always yields the same ladder, so a child's progress is stable
 * without storing anything. Built as a sequence so that a problem can be kept
 * distinct from the few before it, which matters most for K-1 where the space
 * of jumps within 20 is small.
 */
export function generateJumpSequence(
  skill: JumpSkill,
  band: GradeBand,
  level: DifficultyLevel,
  count: number,
): readonly JumpProblem[] {
  return buildSequence(
    count,
    (index, salt) => candidate(skill, band, level, index, salt),
    sameJump,
  );
}

/**
 * Problem `index` for a camp's skill, grade band and current difficulty. Still
 * deterministic: the same four inputs always give the same jump.
 */
export function generateJumpProblem(
  skill: JumpSkill,
  band: GradeBand,
  level: DifficultyLevel,
  index: number,
  /** The jump just finished — see `generateGroupingTask` for why. */
  avoid: JumpProblem | null = null,
): JumpProblem {
  const sequence = generateJumpSequence(skill, band, level, index + 1);
  const problem = sequence[index] ?? candidate(skill, band, level, index, 0);
  if (avoid === null || !sameJump(problem, avoid)) return problem;
  return distinctFrom([avoid], index, (i, salt) => candidate(skill, band, level, i, salt), sameJump);
}
