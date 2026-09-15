import type { GroupingFocus } from "@/lib/domain/camp";
import type { GradeBand } from "@/lib/domain/onboarding";

/** Base-ten block denominations. */
export type PlaceUnit = 1 | 10 | 100 | 1000;

/** Largest first, the order a place-value mat reads left to right. */
export const PLACE_UNITS: readonly [PlaceUnit, ...PlaceUnit[]] = [1000, 100, 10, 1];

export const PLACE_LABEL: Record<PlaceUnit, string> = {
  1: "Ones",
  10: "Tens",
  100: "Hundreds",
  1000: "Thousands",
};

/**
 * One grouping task. Both families are built by dragging pieces into a drop
 * zone — an array frame, or a place-value mat.
 */
export type GroupingTask =
  | {
      readonly kind: "array";
      readonly index: number;
      readonly rows: number;
      readonly cols: number;
      /** Row-strip lengths on offer, one of which is the right one. */
      readonly stripChoices: readonly [number, ...number[]];
    }
  | {
      readonly kind: "place-value";
      readonly index: number;
      readonly target: number;
      /** Block denominations on offer, largest first. */
      readonly unitChoices: readonly [PlaceUnit, ...PlaceUnit[]];
    };

/** How many blocks of each denomination sit on the mat. */
export type PlaceCounts = Readonly<Record<PlaceUnit, number>>;

export const EMPTY_PLACE_COUNTS: PlaceCounts = { 1000: 0, 100: 0, 10: 0, 1: 0 };

/** What the child has built so far. Its shape follows the task's. */
export type Workspace =
  | { readonly kind: "array"; readonly strips: readonly number[] }
  | { readonly kind: "place-value"; readonly counts: PlaceCounts };

export function emptyWorkspace(task: GroupingTask): Workspace {
  switch (task.kind) {
    case "array":
      return { kind: "array", strips: [] };
    case "place-value":
      return { kind: "place-value", counts: EMPTY_PLACE_COUNTS };
  }
}

export interface ArrayBandRange {
  readonly minRows: number;
  readonly maxRows: number;
  readonly minCols: number;
  readonly maxCols: number;
  readonly description: string;
}

export interface PlaceValueBandRange {
  /** Largest denomination the band works with. */
  readonly topUnit: PlaceUnit;
  /** Smallest denomination a task may top out at, so ranges vary. */
  readonly minTopUnit: PlaceUnit;
  /** Smallest leading digit, which sets the band's floor. */
  readonly minTopDigit: number;
  /**
   * Fewest blocks a task may need. Without a floor the easiest level spends
   * its whole budget on the leading digit and hands out round numbers — 2-3's
   * level 1 was `50`, `40`, `30`, which teaches nothing about ones.
   */
  readonly minBlocks: number;
  /** Cap on total blocks, so a task never becomes a dragging chore. */
  readonly maxBlocks: number;
  readonly description: string;
}

export interface GroupingBandRange {
  readonly array: ArrayBandRange;
  readonly placeValue: PlaceValueBandRange;
}

export const GROUPING_BAND_RANGES: Record<GradeBand, GroupingBandRange> = {
  "k-1": {
    array: {
      minRows: 2,
      maxRows: 3,
      minCols: 2,
      maxCols: 5,
      description: "Equal groups up to 15",
    },
    placeValue: {
      topUnit: 10,
      minTopUnit: 10,
      minTopDigit: 1,
      minBlocks: 3,
      maxBlocks: 10,
      description: "Teen numbers as a ten and some ones",
    },
  },
  "2-3": {
    array: {
      minRows: 3,
      maxRows: 6,
      minCols: 3,
      maxCols: 6,
      description: "Facts up to 6 × 6",
    },
    placeValue: {
      topUnit: 10,
      minTopUnit: 10,
      // Starts at 20, so two-digit work does not repeat the K-1 teens.
      minTopDigit: 2,
      minBlocks: 5,
      maxBlocks: 14,
      description: "Two-digit numbers in tens and ones",
    },
  },
  "4-5": {
    array: {
      minRows: 4,
      maxRows: 9,
      minCols: 4,
      maxCols: 9,
      description: "Facts up to 9 × 9",
    },
    placeValue: {
      topUnit: 1000,
      // Some tasks top out at hundreds, so the thousands mat is not a given.
      minTopUnit: 100,
      minTopDigit: 1,
      minBlocks: 6,
      maxBlocks: 15,
      description: "Thousands, hundreds, tens and ones",
    },
  },
};

/** The digit sitting in a given place of `value`. */
export function digitAt(value: number, unit: PlaceUnit): number {
  return Math.floor(value / unit) % 10;
}

/** Total value of the blocks on the mat. */
export function placeCountsValue(counts: PlaceCounts): number {
  return PLACE_UNITS.reduce((sum, unit) => sum + unit * counts[unit], 0);
}

/** Total number of blocks on the mat. */
export function placeCountsSize(counts: PlaceCounts): number {
  return PLACE_UNITS.reduce((sum, unit) => sum + counts[unit], 0);
}

/** The grouping focus as a sentence fragment, for the summary line. */
export function groupingSkillPhrase(focus: GroupingFocus): string {
  return focus === "array" ? "building arrays" : "grouping tens and hundreds";
}

/** The place one denomination trades up into. Ten of a place make one of it. */
const NEXT_UNIT: Partial<Record<PlaceUnit, PlaceUnit>> = {
  1: 10,
  10: 100,
  100: 1000,
};

/** How many of a place it takes to make one of the place above. */
export const TRADE_AT = 10;

/**
 * Ten of one place traded for one of the place above, or `null` when that is
 * not a legal move — fewer than ten there, or nothing above it to trade into.
 *
 * Returning `null` rather than throwing is deliberate: a child tapping a place
 * that cannot trade yet is the interesting wrong answer at camp 4, not an
 * error, and the caller turns it into a hint.
 */
export function tradeUp(counts: PlaceCounts, from: PlaceUnit): PlaceCounts | null {
  const to = NEXT_UNIT[from];
  if (to === undefined || counts[from] < TRADE_AT) return null;
  return { ...counts, [from]: counts[from] - TRADE_AT, [to]: counts[to] + 1 };
}

/**
 * The number written the short way with the places available: one digit per
 * place. The top place carries everything above it, so 5541 on a
 * hundreds-tens-ones mat is fifty-five hundreds rather than five and a lost
 * remainder.
 */
export function tidyCounts(target: number, units: readonly PlaceUnit[]): PlaceCounts {
  const counts = { 1000: 0, 100: 0, 10: 0, 1: 0 };
  const top = units[0] ?? 1;
  for (const unit of units) {
    counts[unit] = unit === top ? Math.floor(target / unit) : digitAt(target, unit);
  }
  return counts;
}

/** Every place holding fewer than ten — the number written the short way. */
export function isTidy(counts: PlaceCounts, units: readonly PlaceUnit[]): boolean {
  return overfullPlace(counts, units) === null;
}

/**
 * The lowest place holding enough blocks to trade up, and where it trades to.
 *
 * A mat can hold the right total and still be wrong — `14` as fourteen ones is
 * the number without the idea. This names the place to work on, and it is what
 * both the sentence the child reads and the ring drawn round the blocks are
 * built from, so the two cannot describe different columns.
 */
export function overfullPlace(
  counts: PlaceCounts,
  units: readonly PlaceUnit[],
): { readonly from: PlaceUnit; readonly to: PlaceUnit } | null {
  const topUnit = units[0];
  for (const unit of [...units].reverse()) {
    if (unit === topUnit) continue;
    const to = NEXT_UNIT[unit];
    if (to !== undefined && counts[unit] >= TRADE_AT) return { from: unit, to };
  }
  return null;
}
