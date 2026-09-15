import { describe, expect, it } from "vitest";
import { badgesFor, newlyEarned, type BadgeId, type BadgeInput } from "./badges";
import { NO_PROGRESS, type LearnerProgress } from "./progress";
import { localDateSchema, type LocalDate } from "./localDate";
import type { ClimbDay } from "./streak";
import type { GradeBand } from "./onboarding";
import { CAMP_NUMBERS, type CampNumber } from "@/lib/domain/camp";
import { MASTERY_MAX } from "@/lib/domain/mastery";

const d = (value: string): LocalDate => localDateSchema.parse(value);
const TODAY = d("2026-09-11");

const BAND: GradeBand = "2-3";

const day = (date: string, camp: CampNumber, solves: number, cleanSolves = 0): ClimbDay => ({
  date: d(date),
  band: BAND,
  camp,
  solves,
  cleanSolves,
});

function runOfDays(last: string, count: number): ClimbDay[] {
  const end = new Date(`${last}T00:00:00Z`).getTime();
  return Array.from({ length: count }, (_, i) =>
    day(new Date(end - (count - 1 - i) * 86_400_000).toISOString().slice(0, 10), 1, 1, 1),
  );
}

function mastered(camps: readonly CampNumber[]): LearnerProgress {
  return {
    totalSolves: 40,
    camps: {
      1: { earned: camps.includes(1) ? MASTERY_MAX : 0, touchedAtSolve: 40 },
      2: { earned: camps.includes(2) ? MASTERY_MAX : 0, touchedAtSolve: 40 },
      3: { earned: camps.includes(3) ? MASTERY_MAX : 0, touchedAtSolve: 40 },
      4: { earned: camps.includes(4) ? MASTERY_MAX : 0, touchedAtSolve: 40 },
    },
  };
}

const input = (over: Partial<BadgeInput> = {}): BadgeInput => ({
  band: BAND,
  progress: NO_PROGRESS,
  days: [],
  today: TODAY,
  checkpointsPassed: 0,
  ...over,
});

const byId = (badges: readonly { id: BadgeId }[]) => new Set(badges.map((badge) => badge.id));

describe("badgesFor", () => {
  it("offers the same seven badges whatever the state", () => {
    const a = badgesFor(input());
    const b = badgesFor(input({ progress: mastered([1, 2, 3, 4]), days: runOfDays("2026-09-11", 30) }));
    expect(a).toHaveLength(7);
    expect(byId(a)).toEqual(byId(b));
  });

  it("starts a fresh grade from nothing, however much another grade has climbed", () => {
    // The reported bug: K-1 fully climbed, then a switch to 2-3 showed First
    // Steps as earned before a single 2-3 problem.
    const otherBand: ClimbDay[] = runOfDays("2026-09-11", 30).map((row) => ({
      ...row,
      band: "k-1",
      solves: 5,
      cleanSolves: 5,
    }));
    const fresh = badgesFor(input({ band: "2-3", days: otherBand }));
    for (const badge of fresh) {
      if (badge.id === "week-of-climbing") continue;
      expect(badge.earned, badge.id).toBe(false);
      expect(badge.progress, badge.id).toBe(0);
    }
    // Turning up is the child's, whatever they were climbing.
    expect(fresh.find((badge) => badge.id === "week-of-climbing")?.earned).toBe(true);
  });

  it("earns nothing for a brand new climber, and shows no progress either", () => {
    for (const badge of badgesFor(input())) {
      expect(badge.earned).toBe(false);
      expect(badge.progress).toBe(0);
    }
  });

  it("gives every badge a name, a glyph and a condition in plain words", () => {
    for (const badge of badgesFor(input())) {
      expect(badge.name.length).toBeGreaterThan(0);
      expect(badge.glyph.length).toBeGreaterThan(0);
      expect(badge.how.length).toBeGreaterThan(0);
    }
  });

  it("earns the first badge on the very first solve", () => {
    const badges = badgesFor(input({ days: [day("2026-09-11", 1, 1)] }));
    expect(badges.find((badge) => badge.id === "first-climb")?.earned).toBe(true);
  });

  it("earns Camp Master on one full meter and Summiteer only on all four", () => {
    const one = badgesFor(input({ progress: mastered([1]) }));
    expect(one.find((badge) => badge.id === "camp-mastered")?.earned).toBe(true);
    expect(one.find((badge) => badge.id === "summit")?.earned).toBe(false);
    expect(one.find((badge) => badge.id === "summit")?.progress).toBe(1 / CAMP_NUMBERS.length);

    const all = badgesFor(input({ progress: mastered([1, 2, 3, 4]) }));
    expect(all.find((badge) => badge.id === "summit")?.earned).toBe(true);
  });

  it("earns Seven Days on a seven-day run and not on six", () => {
    expect(
      badgesFor(input({ days: runOfDays("2026-09-11", 6) })).find((b) => b.id === "week-of-climbing")
        ?.earned,
    ).toBe(false);
    expect(
      badgesFor(input({ days: runOfDays("2026-09-11", 7) })).find((b) => b.id === "week-of-climbing")
        ?.earned,
    ).toBe(true);
  });

  it("earns Seven Days from a past run, since the longest streak never decays", () => {
    const days = [...runOfDays("2026-06-01", 7), day("2026-09-11", 1, 1)];
    expect(badgesFor(input({ days })).find((b) => b.id === "week-of-climbing")?.earned).toBe(true);
  });

  it("earns Century at exactly 100 problems", () => {
    expect(
      badgesFor(input({ days: [day("2026-09-11", 1, 99)] })).find((b) => b.id === "hundred-problems")
        ?.earned,
    ).toBe(false);
    expect(
      badgesFor(input({ days: [day("2026-09-11", 1, 100)] })).find((b) => b.id === "hundred-problems")
        ?.earned,
    ).toBe(true);
  });

  it("earns Sharp Shooter only with enough solves and enough accuracy", () => {
    const sharp = (solves: number, clean: number) =>
      badgesFor(input({ days: [day("2026-09-10", 1, solves, clean)] })).find(
        (badge) => badge.id === "sharp-shooter",
      );
    // Accurate but too few solves to judge.
    expect(sharp(10, 10)?.earned).toBe(false);
    // Enough solves, just under the accuracy bar.
    expect(sharp(20, 15)?.earned).toBe(false);
    // Enough of both.
    expect(sharp(20, 16)?.earned).toBe(true);
  });

  it("earns Back On Track on a passed checkpoint, which cannot be derived", () => {
    expect(badgesFor(input()).find((b) => b.id === "back-on-track")?.earned).toBe(false);
    expect(
      badgesFor(input({ checkpointsPassed: 1 })).find((b) => b.id === "back-on-track")?.earned,
    ).toBe(true);
  });

  it("keeps progress a fraction, and reads full whenever a badge is earned", () => {
    const states = [
      input(),
      input({ days: [day("2026-09-11", 1, 3, 2)] }),
      input({ progress: mastered([1, 2]), days: runOfDays("2026-09-11", 4), checkpointsPassed: 2 }),
      input({ progress: mastered([1, 2, 3, 4]), days: [day("2026-09-11", 1, 200, 190)] }),
    ];
    for (const state of states) {
      for (const badge of badgesFor(state)) {
        expect(badge.progress).toBeGreaterThanOrEqual(0);
        expect(badge.progress).toBeLessThanOrEqual(1);
        if (badge.earned) expect(badge.progress).toBe(1);
      }
    }
  });

  it("never un-earns a badge as the record grows", () => {
    let earned = new Set<BadgeId>();
    const days: ClimbDay[] = [];
    for (let i = 0; i < 30; i += 1) {
      days.push(day(new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10), 1, 4, 4));
      const now = badgesFor(input({ days, progress: mastered([1]), today: TODAY }));
      const next = new Set(now.filter((badge) => badge.earned).map((badge) => badge.id));
      for (const id of earned) expect(next).toContain(id);
      earned = next;
    }
  });

  it("is derived, so the same input always gives the same answer", () => {
    const state = input({ progress: mastered([1, 2]), days: runOfDays("2026-09-11", 5) });
    expect(badgesFor(state)).toEqual(badgesFor(state));
  });
});

describe("newlyEarned", () => {
  const before = badgesFor(input());
  const after = badgesFor(input({ progress: mastered([1]), days: [day("2026-09-11", 1, 3)], checkpointsPassed: 1 }));

  it("lists only the badges that crossed over", () => {
    expect(byId(newlyEarned(before, after))).toEqual(
      new Set(["first-climb", "camp-mastered", "back-on-track"]),
    );
  });

  it("lists nothing when nothing changed", () => {
    expect(newlyEarned(after, after)).toHaveLength(0);
  });

  it("lists nothing when a badge was already held", () => {
    expect(newlyEarned(after, before)).toHaveLength(0);
  });
});
