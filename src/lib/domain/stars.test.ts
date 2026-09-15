import { describe, expect, it } from "vitest";
import { STAR_ACCURACY, STAR_EFFORT, starReason, starsForSession } from "./stars";

describe("starsForSession", () => {
  it("gives nothing for a sitting with no solves", () => {
    expect(starsForSession({ solved: 0, cleanSolves: 0 })).toBe(0);
  });

  it("gives one star for turning up at all", () => {
    expect(starsForSession({ solved: 1, cleanSolves: 0 })).toBe(1);
    expect(starsForSession({ solved: STAR_EFFORT - 1, cleanSolves: 0 })).toBe(1);
  });

  it("gives two for a proper stint that was not sharp", () => {
    expect(starsForSession({ solved: STAR_EFFORT, cleanSolves: 0 })).toBe(2);
  });

  it("gives three once the stint is also accurate", () => {
    const clean = Math.ceil(STAR_EFFORT * STAR_ACCURACY);
    expect(starsForSession({ solved: STAR_EFFORT, cleanSolves: clean })).toBe(3);
  });

  it("treats the accuracy threshold as inclusive", () => {
    // 7/10 is exactly STAR_ACCURACY and must earn the third star.
    expect(starsForSession({ solved: 10, cleanSolves: 7 })).toBe(3);
    expect(starsForSession({ solved: 10, cleanSolves: 6 })).toBe(2);
  });

  it("never punishes: more solves can only hold or raise the rating", () => {
    let previous = 0;
    for (let solved = 0; solved <= 40; solved += 1) {
      const stars = starsForSession({ solved, cleanSolves: solved });
      expect(stars).toBeGreaterThanOrEqual(previous);
      previous = stars;
    }
  });
});

describe("starReason", () => {
  it("says something for every possible rating", () => {
    const tallies = [
      { solved: 0, cleanSolves: 0 },
      { solved: 2, cleanSolves: 1 },
      { solved: 9, cleanSolves: 2 },
      { solved: 9, cleanSolves: 9 },
    ];
    const seen = new Set<number>();
    for (const tally of tallies) {
      seen.add(starsForSession(tally));
      expect(starReason(tally).length).toBeGreaterThan(0);
    }
    expect(seen).toEqual(new Set([0, 1, 2, 3]));
  });

  it("never scolds", () => {
    for (const solved of [0, 1, 5, 20]) {
      const reason = starReason({ solved, cleanSolves: 0 }).toLowerCase();
      for (const word of ["fail", "lost", "bad", "wrong", "poor"]) {
        expect(reason).not.toContain(word);
      }
    }
  });
});
