import {
  PLACE_UNITS,
  TRADE_AT,
  isTidy,
  placeCountsValue,
  tidyCounts,
  type PlaceCounts,
  type PlaceUnit,
} from "@/lib/domain/grouping";
import type { DifficultyLevel } from "@/lib/domain/difficulty";
import type { GradeBand } from "@/lib/domain/onboarding";
import { createRng, hashSeed } from "@/lib/math/rng";
import { generateGroupingTask } from "@/lib/math/groupingTasks";
import { distinctFrom } from "@/lib/math/sequence";

/**
 * One trade-up task: a number already on the mat, but written the untidy way.
 *
 * Camp 4 used to ask the child to *build* a number, which is the same act as
 * camp 3's array with different blocks — the thing that made the two camps feel
 * alike. This asks the opposite: the number is already there, and the job is to
 * tidy it, trading ten of a place for one of the place above until no place
 * holds ten. That is regrouping as something you *do* rather than something
 * that happens to you, and it is the idea the summit is for.
 */
export interface TradeTask {
  readonly index: number;
  /** The number on the mat. Trading never changes it — that is the point. */
  readonly target: number;
  /** Denominations in play, largest first. */
  readonly units: readonly [PlaceUnit, ...PlaceUnit[]];
  /** How the number starts out: at least one place holding ten or more. */
  readonly start: PlaceCounts;
}

/** One of a place broken back down into ten of the place below. */
function borrowDown(
  counts: PlaceCounts,
  unit: PlaceUnit,
  units: readonly PlaceUnit[],
): PlaceCounts | null {
  const below = units[units.indexOf(unit) + 1];
  if (below === undefined || counts[unit] < 1) return null;
  return { ...counts, [unit]: counts[unit] - 1, [below]: counts[below] + TRADE_AT };
}

/** How many trades the child should have to make, by level. */
function tradesFor(level: DifficultyLevel): number {
  if (level <= 2) return 1;
  if (level <= 4) return 2;
  return 3;
}

function candidate(
  band: GradeBand,
  level: DifficultyLevel,
  index: number,
  salt: number,
): TradeTask {
  /*
   * The number itself comes from the place-value ladder, so camp 4 still meets
   * exactly the range the difficulty table promises.
   *
   * The salt shifts which number is drawn, not just how it is scruffed, and it
   * has to: a K-1 teen has exactly one untidy layout — all ones — so re-rolling
   * the scruff of `12` can only ever produce twelve ones again. Only a
   * different target can break a repeat there. Salt 0 is the ordinary ladder
   * position, so the normal path is untouched.
   */
  const task = generateGroupingTask("place-value", band, level, index + salt);
  const target = task.kind === "place-value" ? task.target : 10;
  const units = task.kind === "place-value" ? task.unitChoices : PLACE_UNITS;

  const rng = createRng(hashSeed(`trade:${band}:${String(level)}:${String(index)}:${String(salt)}`));
  let counts = tidyCounts(target, units);

  const wanted = tradesFor(level);
  let made = 0;
  for (let attempt = 0; attempt < wanted * 3 && made < wanted; attempt += 1) {
    const holders = units.slice(0, -1).filter((unit) => counts[unit] >= 1);
    if (holders.length === 0) break;
    const pick = holders[rng.int(0, holders.length - 1)] ?? holders[0];
    const next = pick === undefined ? null : borrowDown(counts, pick, units);
    if (next === null) break;
    counts = next;
    made += 1;
  }

  return { index, target, units, start: counts };
}

function sameTask(a: TradeTask, b: TradeTask): boolean {
  return (
    a.target === b.target && PLACE_UNITS.every((unit) => a.start[unit] === b.start[unit])
  );
}

/**
 * The trade-up task at `index`, never the same as the one just finished.
 *
 * `avoid` exists for the same reason it does on the other generators: the
 * ladder keeps a task distinct from its neighbours *at its own level*, and the
 * level changes between problems.
 */
export function generateTradeTask(
  band: GradeBand,
  level: DifficultyLevel,
  index: number,
  avoid: TradeTask | null = null,
): TradeTask {
  const task = candidate(band, level, index, 0);
  if (avoid === null || !sameTask(task, avoid)) return task;
  return distinctFrom([avoid], index, (at, salt) => candidate(band, level, at, salt), sameTask);
}

/** Whether a task is actually a puzzle: the value is right, the writing is not. */
export function needsTrading(task: TradeTask): boolean {
  return placeCountsValue(task.start) === task.target && !isTidy(task.start, task.units);
}
