import { TRADE_AT, type PlaceCounts, type PlaceUnit } from "@/lib/domain/grouping";

/**
 * THE DIAGNOSIS RULE FOR CAMP 4: what a wrong number typed for the mat was.
 *
 * The mat shows a number the long way — `7 tens and 14 ones` — and the child
 * types what it is worth. The wrong answers are not random: they are the
 * classic place-value slips, and each one can be told from the counts alone.
 * Named rather than counted, so the coach can say the specific thing to fix
 * and the summary can say which slip stopped happening.
 *
 * Arithmetic only; no words. The words are `tradeHint` in `tradeCopy.ts`,
 * and the model is handed the name, never a digit.
 */
export type TradeSlip =
  /** Wrote the counts next to each other: `714` for 7 tens and 14 ones. */
  | "places-side-by-side"
  /** Dropped every carry: `74` for 7 tens and 14 ones. The ringed ten was missed. */
  | "forgot-to-carry"
  /** One away. Nearly always a miscount of the ones. */
  | "off-by-one"
  /** Answered with a single place — `70`, `14` or just `7` — instead of all of them. */
  | "one-place-only"
  /** None of the above. */
  | "miscounted";

/** What the counts add up to. */
export function valueOf(counts: PlaceCounts, units: readonly PlaceUnit[]): number {
  return units.reduce((sum, unit) => sum + counts[unit] * unit, 0);
}

/**
 * The value if every place were read as a digit and no ten carried: the top
 * place keeps its whole count, since it has nowhere to carry to.
 */
function withoutCarries(counts: PlaceCounts, units: readonly PlaceUnit[]): number {
  const top = units[0];
  return units.reduce(
    (sum, unit) => sum + (unit === top ? counts[unit] : counts[unit] % TRADE_AT) * unit,
    0,
  );
}

/** The counts written side by side as digits: `7` and `14` become `714`. */
function sideBySide(counts: PlaceCounts, units: readonly PlaceUnit[]): number {
  return Number(units.map((unit) => String(counts[unit])).join(""));
}

export function diagnoseTrade(
  answer: number,
  counts: PlaceCounts,
  units: readonly PlaceUnit[],
  target: number,
): TradeSlip {
  if (answer === sideBySide(counts, units)) return "places-side-by-side";
  const dropped = withoutCarries(counts, units);
  if (dropped !== target && answer === dropped) return "forgot-to-carry";
  if (Math.abs(answer - target) === 1) return "off-by-one";
  if (units.some((unit) => answer === counts[unit] * unit || answer === counts[unit])) {
    return "one-place-only";
  }
  return "miscounted";
}
