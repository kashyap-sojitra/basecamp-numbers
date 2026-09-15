import type { GroupingFocus } from "@/lib/domain/camp";
import { DIFFICULTY_LEVELS, levelBand, type DifficultyLevel } from "@/lib/domain/difficulty";
import type { GroupingTask, PlaceUnit } from "@/lib/domain/grouping";
import { GROUPING_BAND_RANGES, PLACE_UNITS, digitAt } from "@/lib/domain/grouping";
import type { GradeBand } from "@/lib/domain/onboarding";
import { createRng, hashSeed, type Rng } from "@/lib/math/rng";
import { buildSequence, distinctFrom } from "@/lib/math/sequence";

/**
 * Strip lengths offered alongside the right one, as near misses. Bounded by
 * the band's widest array so no strip is too long to sit in the frame.
 */
function stripChoicesFor(cols: number, maxCols: number): readonly [number, ...number[]] {
  const candidates = new Set<number>([cols]);
  for (const delta of [-2, -1, 1, 2, 3, -3]) {
    const option = cols + delta;
    if (option >= 2 && option <= maxCols && candidates.size < 5) candidates.add(option);
  }
  const sorted = [...candidates].sort((a, b) => a - b);
  // `cols` is always in the set, so the list is never empty.
  const [first, ...rest] = sorted;
  return [first ?? cols, ...rest];
}

function arrayTask(
  rng: Rng,
  band: GradeBand,
  level: DifficultyLevel,
  index: number,
): GroupingTask {
  const range = GROUPING_BAND_RANGES[band].array;
  // Difficulty decides how much of the band's array range is in play.
  const rowBand = levelBand(range.minRows, range.maxRows, level);
  const colBand = levelBand(range.minCols, range.maxCols, level);
  const rows = rng.int(rowBand.lo, rowBand.hi);
  const cols = rng.int(colBand.lo, colBand.hi);
  return {
    kind: "array",
    index,
    rows,
    cols,
    stripChoices: stripChoicesFor(cols, range.maxCols),
  };
}

/** Denominations at or below `topUnit`, largest first. */
function unitsUpTo(topUnit: PlaceUnit): readonly [PlaceUnit, ...PlaceUnit[]] {
  const units = PLACE_UNITS.filter((unit) => unit <= topUnit);
  const [first, ...rest] = units;
  return [first ?? 1, ...rest];
}

/**
 * A target built place by place against a block budget, so every task is
 * placeable without a dragging marathon and the digits stay well spread.
 * Drawing digits freely and trimming afterwards skews them towards zero.
 */
function placeValueTask(
  rng: Rng,
  band: GradeBand,
  level: DifficultyLevel,
  index: number,
): GroupingTask {
  const range = GROUPING_BAND_RANGES[band].placeValue;

  // Teens are their own thing: exactly one ten, and some ones.
  if (band === "k-1") {
    const ones = levelBand(1, 9, level);
    return {
      kind: "place-value",
      index,
      target: 10 + rng.int(ones.lo, ones.hi),
      unitChoices: unitsUpTo(10),
    };
  }

  /*
   * How many places are in play grows with *difficulty*, not at random.
   * Drawing it randomly meant a 4-5 level-1 task could be anything from 101 to
   * 3300 — the level barely constrained the number of digits, which is most of
   * what makes a place-value task hard.
   */
  const tops = PLACE_UNITS.filter(
    (unit) => unit <= range.topUnit && unit >= range.minTopUnit,
  );
  // PLACE_UNITS runs largest first; easiest is the smallest top place.
  const ascending = [...tops].reverse();
  const groupOf = (at: DifficultyLevel) =>
    Math.min(
      ascending.length - 1,
      Math.floor(((at - 1) * ascending.length) / DIFFICULTY_LEVELS.length),
    );
  const group = groupOf(level);
  const topUnit = ascending[group] ?? range.topUnit;
  const units = unitsUpTo(topUnit);

  /*
   * Which of this group's levels we are on. The leading digit climbs *within*
   * a place count and resets when a new place opens, so gaining a digit is the
   * only step-change a child meets. Climbing both at once put a cliff between
   * levels 3 and 4 for 4-5: 651 straight to 3001.
   */
  const sameGroup = DIFFICULTY_LEVELS.filter((at) => groupOf(at) === group);
  const rung = Math.max(0, sameGroup.indexOf(level));

  // A tighter budget at low levels means smaller, simpler numbers — but never
  // so tight that the budget goes entirely on the leading digit.
  const budget = levelBand(Math.max(range.minBlocks, units.length + 1), range.maxBlocks, level);
  let remaining = rng.int(budget.lo, budget.hi);
  let target = 0;

  /*
   * The leading digit's floor rises a step per level within the place count.
   * The block budget alone was not enough: it caps the *work*, not the
   * *value*, so level 5 could still draw a leading 2 and hand a third-year
   * child `20`. Capped at 9, and it never starts a new place count high.
   */
  const topDigitFloor = Math.min(9, range.minTopDigit + rung);

  units.forEach((unit, position) => {
    const placesLeft = units.length - position;
    const min = unit === topUnit ? topDigitFloor : 0;
    // Leave room for the places still to come, and keep any one place modest.
    const share = Math.floor(remaining / placesLeft) + 2;
    const cap = Math.max(min, Math.min(9, share, remaining));
    const digit = rng.int(min, cap);
    remaining -= digit;
    target += unit * digit;
  });

  return { kind: "place-value", index, target, unitChoices: units };
}

function candidate(
  focus: GroupingFocus,
  band: GradeBand,
  level: DifficultyLevel,
  index: number,
  salt: number,
): GroupingTask {
  const rng = createRng(
    hashSeed(`grouping:${focus}:${band}:${String(level)}:${String(index)}:${String(salt)}`),
  );
  return focus === "array"
    ? arrayTask(rng, band, level, index)
    : placeValueTask(rng, band, level, index);
}

function sameTask(a: GroupingTask, b: GroupingTask): boolean {
  if (a.kind === "array" && b.kind === "array") {
    return a.rows === b.rows && a.cols === b.cols;
  }
  if (a.kind === "place-value" && b.kind === "place-value") {
    return a.target === b.target;
  }
  return false;
}

/**
 * The first `count` tasks for a focus and grade band, in order. Deterministic,
 * like the number-line ladder, and kept distinct from the few before it.
 */
export function generateGroupingSequence(
  focus: GroupingFocus,
  band: GradeBand,
  level: DifficultyLevel,
  count: number,
): readonly GroupingTask[] {
  return buildSequence(
    count,
    (index, salt) => candidate(focus, band, level, index, salt),
    sameTask,
  );
}

/**
 * Task `index` for a focus, grade band and current difficulty. Deterministic
 * in all four inputs.
 */
export function generateGroupingTask(
  focus: GroupingFocus,
  band: GradeBand,
  level: DifficultyLevel,
  index: number,
  /**
   * The task just finished, if any. The ladder only keeps a task distinct from
   * the others *at its own level*, and difficulty changes between problems —
   * so a level change used to hand the child the same task twice running.
   */
  avoid: GroupingTask | null = null,
): GroupingTask {
  const sequence = generateGroupingSequence(focus, band, level, index + 1);
  const task = sequence[index] ?? candidate(focus, band, level, index, 0);
  if (avoid === null || !sameTask(task, avoid)) return task;
  return distinctFrom([avoid], index, (i, salt) => candidate(focus, band, level, i, salt), sameTask);
}

/** The canonical block count for a place, used to check a mat is grouped. */
export function expectedBlocks(target: number, unit: PlaceUnit, topUnit: PlaceUnit): number {
  return unit === topUnit ? Math.floor(target / unit) : digitAt(target, unit);
}
