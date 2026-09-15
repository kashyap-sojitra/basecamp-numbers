/** How many slips a sitting remembers. Enough to spot a pattern, bounded. */
export const SLIP_MEMORY = 12;

/**
 * The slips a sitting remembers, oldest first. Kept so the summary line can
 * name a slip that *stopped* happening, which is what "what you got better at"
 * means; bounded so a long sitting cannot grow the request without limit.
 */
export function rememberSlip<T extends string>(slips: readonly T[], slip: T): readonly T[] {
  return [...slips, slip].slice(-SLIP_MEMORY);
}
