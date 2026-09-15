/**
 * One set of motion values for the whole app, so everything feels like it
 * belongs to the same world. Bouncy enough to read as playful, short enough
 * that a child never waits on the interface.
 */
export const SPRING = {
  /** Default: pieces settling into place. */
  settle: { type: "spring", stiffness: 320, damping: 24 } as const,
  /** Snappier, for taps and small state flips. */
  snap: { type: "spring", stiffness: 520, damping: 30 } as const,
  /** Loose and bouncy, for arrivals that should feel fun. */
  bounce: { type: "spring", stiffness: 260, damping: 14 } as const,
};

/** Cool joy colours for incidental sparkle. Warm hues stay reserved. */
export const SPARKLE_COLORS = [
  "var(--brand)",
  "var(--brand-soft)",
  "var(--info)",
  "var(--mint)",
  "var(--grape)",
  "var(--berry)",
] as const;

/** Warm palette, allowed only for reward celebrations. */
export const CELEBRATION_COLORS = [
  "var(--reward)",
  "var(--reward-deep)",
  "var(--reward-soft)",
  "var(--brand)",
  "var(--mint)",
] as const;

/** Picks from a non-empty list; the first entry covers the edge case. */
export function pick<T>(items: readonly [T, ...T[]]): T {
  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? items[0];
}

/**
 * A key that changes on every answer, so a reaction burst replays even when
 * two answers in a row look the same to React.
 *
 * The solve count alone is not enough: a wrong answer leaves it unchanged, and
 * a right answer after a wobble would collide with the wobble itself. Spacing
 * solves a thousand apart keeps the two counters from ever colliding.
 */
export function reactionKey(solved: number, wrongAttempts: number): number {
  return solved * 1000 + wrongAttempts + 1;
}
