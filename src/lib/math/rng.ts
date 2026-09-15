/**
 * Deterministic PRNG. Same seed always yields the same sequence, so problem
 * number N for a grade band is identical on every device and every visit —
 * no persistence needed to keep a child's ladder stable.
 */
export interface Rng {
  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  /** Picks one element; the array must not be empty. */
  pick<T>(items: readonly [T, ...T[]]): T;
}

/** mulberry32 — small, fast, good enough for problem selection. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(items) {
      const index = Math.floor(next() * items.length);
      // The tuple's first element is always present, so it covers the
      // vanishingly rare case of next() returning exactly 1.
      return items[index] ?? items[0];
    },
  };
}

/** FNV-1a, so a seed can be derived from readable strings. */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
