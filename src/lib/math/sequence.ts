/**
 * Building a ladder of problems that does not repeat itself.
 *
 * Both generators face the same difficulty: a problem must be deterministic
 * in its index, yet differ from the few before it — and in a small space
 * (K-1 has three teen targets at level 1) there are fewer problems available
 * than the window is wide, so "all different" is impossible.
 *
 * The answer is to relax the window rather than to give up on it. Whatever
 * the space, the *previous* problem can always be avoided as long as two
 * exist, and a child noticing "I just did this one" is the repeat that
 * actually matters.
 */

/** How many recent problems a new one should differ from, given the room. */
export const LOOKBACK = 3;

/** Salts tried per window before widening the search. Keeps this terminating. */
const MAX_SALT = 12;

/**
 * One problem for `index`, as distinct from the tail of `sequence` as the
 * space allows: first try to differ from the last `LOOKBACK`, then from
 * fewer, and settle for differing from the one immediately before it.
 */
export function distinctFrom<T>(
  sequence: readonly T[],
  index: number,
  make: (index: number, salt: number) => T,
  same: (a: T, b: T) => boolean,
): T {
  for (let window = LOOKBACK; window >= 1; window -= 1) {
    const recent = sequence.slice(-window);
    for (let salt = 0; salt <= MAX_SALT; salt += 1) {
      const candidate = make(index, salt);
      if (!recent.some((seen) => same(seen, candidate))) return candidate;
    }
  }
  // Only reachable if a space holds exactly one problem, where every ladder
  // is that problem repeated and there is nothing better to return.
  return make(index, 0);
}

/**
 * The first `count` problems, in order and deterministic: the same inputs
 * always give the same ladder, so a child's progress is stable without
 * storing anything.
 */
export function buildSequence<T>(
  count: number,
  make: (index: number, salt: number) => T,
  same: (a: T, b: T) => boolean,
): readonly T[] {
  const sequence: T[] = [];
  for (let index = 0; index < count; index += 1) {
    sequence.push(distinctFrom(sequence, index, make, same));
  }
  return sequence;
}

/**
 * How many rungs of the ladder a sitting can start from before the openings
 * begin to come round again.
 *
 * Bounded because a problem costs one pass over the ladder before it: an
 * unbounded offset would make the thousandth problem a thousand times dearer
 * than the first, for no gain a child would notice.
 */
export const LADDER_CYCLE = 60;

/**
 * Where a sitting picks the ladder up.
 *
 * Determinism alone meant every K-1 climber opened camp 1 with `5 + 2` on
 * every visit. Starting from the child's own solve count keeps the ladder
 * reproducible — still a pure function of state the server holds — while
 * giving each sitting a new opening.
 */
export function ladderStart(totalSolves: number): number {
  if (!Number.isFinite(totalSolves) || totalSolves <= 0) return 0;
  return Math.floor(totalSolves) % LADDER_CYCLE;
}
