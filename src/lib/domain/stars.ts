/**
 * Stars for one sitting. These describe *this session* — effort and accuracy
 * on the day — while the Mastery Meter carries lasting progress. They are
 * deliberately not a second currency: nothing unlocks with stars, and they are
 * never spent or taken away.
 */

export type Stars = 0 | 1 | 2 | 3;

/** Problems solved before the second and third stars are in reach. */
export const STAR_EFFORT = 5;

/** Share of solves that must be right first time for the third star. */
export const STAR_ACCURACY = 0.7;

/** What a session did, as the star rule sees it. */
export interface SessionTally {
  /** Problems solved in this sitting. */
  readonly solved: number;
  /** Of those, how many were right first time. */
  readonly cleanSolves: number;
}

/**
 * THE STAR RULE.
 *
 *   solved nothing            -> 0 stars (the screen says "come back soon")
 *   solved anything           -> 1 star  (turning up counts)
 *   solved 5 or more          -> 2 stars (a proper stint)
 *   ...and 70% right first try-> 3 stars (a sharp stint)
 *
 * Never punitive: a wobbly session still earns its star, and a star is never
 * removed once given.
 */
export function starsForSession(tally: SessionTally): Stars {
  if (tally.solved <= 0) return 0;
  if (tally.solved < STAR_EFFORT) return 1;
  const accuracy = tally.cleanSolves / tally.solved;
  return accuracy >= STAR_ACCURACY ? 3 : 2;
}

/** The reason the child got the stars they got, in their own terms. */
export function starReason(tally: SessionTally): string {
  const stars = starsForSession(tally);
  switch (stars) {
    case 0:
      return "No problems this time — the mountain will keep.";
    case 1:
      return `${String(tally.solved)} solved. Every jump counts.`;
    case 2:
      return `${String(tally.solved)} solved. That is a proper stint of climbing.`;
    case 3:
      return `${String(tally.solved)} solved, ${String(tally.cleanSolves)} first time. Sharp work.`;
  }
}
