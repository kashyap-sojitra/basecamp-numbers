import { describe, expect, it } from "vitest";
import {
  DAILY_GOAL,
  STREAK_GRACE_DAYS,
  campBestDay,
  climbTotals,
  streakFrom,
  streakMessage,
  todayView,
  type ClimbDay,
} from "./streak";
import { localDateSchema, type LocalDate } from "./localDate";
import type { CampNumber } from "@/lib/domain/camp";

const d = (value: string): LocalDate => localDateSchema.parse(value);
const TODAY = d("2026-09-11");

const day = (date: string, camp: CampNumber, solves: number, cleanSolves = 0): ClimbDay => ({
  date: d(date),
  band: "2-3",
  camp,
  solves,
  cleanSolves,
});

/** A run of consecutive days ending on `last`, all in camp 1. */
function runOfDays(last: string, count: number): ClimbDay[] {
  const end = new Date(`${last}T00:00:00Z`).getTime();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(end - (count - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return day(date, 1, 1, 1);
  });
}

describe("the streak's own settings", () => {
  it("gives a day a reachable goal and a streak one day of grace", () => {
    expect(DAILY_GOAL).toBeGreaterThan(0);
    expect(DAILY_GOAL).toBeLessThanOrEqual(10);
    expect(STREAK_GRACE_DAYS).toBe(1);
  });
});

describe("streakFrom", () => {
  it("reports nothing for a climber who has never solved anything", () => {
    expect(streakFrom([], TODAY)).toMatchObject({
      status: "unstarted",
      current: 0,
      longest: 0,
      climbedToday: false,
      lastClimb: null,
    });
  });

  it("does not count a logged day with no solves in it", () => {
    expect(streakFrom([day("2026-09-11", 1, 0)], TODAY).status).toBe("unstarted");
  });

  it("counts today alone as a one-day streak", () => {
    const view = streakFrom([day("2026-09-11", 1, 3)], TODAY);
    expect(view).toMatchObject({ status: "climbing", current: 1, climbedToday: true });
  });

  it("keeps the streak alive when the last climb was yesterday", () => {
    const view = streakFrom([day("2026-09-10", 1, 3)], TODAY);
    expect(view).toMatchObject({ status: "climbing", current: 1, climbedToday: false });
  });

  it("rests the streak once two days have passed, remembering its length", () => {
    const view = streakFrom([day("2026-09-08", 1, 3), day("2026-09-09", 1, 3)], TODAY);
    expect(view).toMatchObject({ status: "resting", current: 0, resting: 2, longest: 2 });
  });

  it("keeps the longest run even after the current one lapses", () => {
    const days = [...runOfDays("2026-08-20", 9), day("2026-09-09", 1, 1)];
    const view = streakFrom(days, TODAY);
    expect(view.status).toBe("resting");
    expect(view.longest).toBe(9);
  });

  it("counts only the live run as current, ignoring an earlier longer one", () => {
    const days = [...runOfDays("2026-08-20", 9), ...runOfDays("2026-09-11", 3)];
    const view = streakFrom(days, TODAY);
    expect(view.current).toBe(3);
    expect(view.longest).toBe(9);
  });

  it("treats several camps on one day as a single climbed day", () => {
    const view = streakFrom([day("2026-09-11", 1, 2), day("2026-09-11", 3, 2)], TODAY);
    expect(view.current).toBe(1);
  });

  it("does not care what order the rows arrive in", () => {
    const days = runOfDays("2026-09-11", 7);
    expect(streakFrom([...days].reverse(), TODAY)).toEqual(streakFrom(days, TODAY));
  });

  it("counts a seven-day run exactly", () => {
    expect(streakFrom(runOfDays("2026-09-11", 7), TODAY).current).toBe(7);
  });

  it("survives a single missed day only at the end of the run", () => {
    // Missed yesterday, climbed the day before: still alive, run of 2.
    const days = [day("2026-09-08", 1, 1), day("2026-09-09", 1, 1)];
    expect(streakFrom(days, d("2026-09-10")).status).toBe("climbing");
    // A gap inside the history still breaks the run into two.
    const withGap = [day("2026-09-05", 1, 1), day("2026-09-07", 1, 1), day("2026-09-08", 1, 1)];
    expect(streakFrom(withGap, d("2026-09-08")).current).toBe(2);
  });

  it("never reports a current run longer than the longest", () => {
    for (let length = 1; length <= 20; length += 1) {
      const view = streakFrom(runOfDays("2026-09-11", length), TODAY);
      expect(view.current).toBeLessThanOrEqual(view.longest);
    }
  });
});

describe("todayView", () => {
  const days = [
    day("2026-09-11", 1, 3, 2),
    day("2026-09-11", 2, 1, 1),
    day("2026-09-10", 1, 9, 9),
  ];

  it("sums only today, across every camp", () => {
    expect(todayView(days, TODAY)).toMatchObject({ solves: 4, cleanSolves: 3 });
  });

  it("counts down to the daily goal", () => {
    expect(todayView(days, TODAY).remaining).toBe(DAILY_GOAL - 4);
    expect(todayView(days, TODAY).goalMet).toBe(false);
  });

  it("clamps the countdown at zero once the goal is met or passed", () => {
    const met = todayView([day("2026-09-11", 1, DAILY_GOAL + 5)], TODAY);
    expect(met.goalMet).toBe(true);
    expect(met.remaining).toBe(0);
  });

  it("reads an empty log as an empty day", () => {
    expect(todayView([], TODAY)).toMatchObject({ solves: 0, cleanSolves: 0, goalMet: false });
  });
});

describe("streakMessage", () => {
  const empty = todayView([], TODAY);

  it("invites a first climb", () => {
    expect(streakMessage(streakFrom([], TODAY), empty)).toContain("start your streak");
  });

  it("describes a resting streak warmly, naming its length", () => {
    const view = streakFrom([day("2026-09-07", 1, 1), day("2026-09-08", 1, 1)], TODAY);
    expect(streakMessage(view, empty)).toContain("2-day streak is resting");
  });

  it("handles a one-day streak lapsing without naming a length", () => {
    const view = streakFrom([day("2026-09-08", 1, 1)], TODAY);
    expect(streakMessage(view, empty)).toBe("Climb today to start a new streak.");
  });

  it("nudges when the streak is alive but today is untouched", () => {
    const view = streakFrom([day("2026-09-10", 1, 1)], TODAY);
    expect(streakMessage(view, empty)).toContain("climb today to keep it going");
  });

  it("counts down the day's remaining problems", () => {
    const days = [day("2026-09-11", 1, 1)];
    const message = streakMessage(streakFrom(days, TODAY), todayView(days, TODAY));
    expect(message).toContain(`${String(DAILY_GOAL - 1)} more today`);
  });

  it("says the day is done once the goal is met, with the right plural", () => {
    const oneDay = [day("2026-09-11", 1, DAILY_GOAL)];
    expect(streakMessage(streakFrom(oneDay, TODAY), todayView(oneDay, TODAY))).toBe(
      "1 day in a row. Today's climb is done.",
    );
    const fourDays = runOfDays("2026-09-11", 4).map((entry) =>
      entry.date === TODAY ? { ...entry, solves: DAILY_GOAL } : entry,
    );
    expect(streakMessage(streakFrom(fourDays, TODAY), todayView(fourDays, TODAY))).toBe(
      "4 days in a row. Today's climb is done.",
    );
  });

  it("never scolds, in any state", () => {
    const states = [
      streakFrom([], TODAY),
      streakFrom([day("2026-09-10", 1, 1)], TODAY),
      streakFrom([day("2026-09-01", 1, 1), day("2026-09-02", 1, 1)], TODAY),
      streakFrom(runOfDays("2026-09-11", 9), TODAY),
    ];
    for (const view of states) {
      for (const today of [empty, todayView([day("2026-09-11", 1, DAILY_GOAL)], TODAY)]) {
        const message = streakMessage(view, today).toLowerCase();
        expect(message.length).toBeGreaterThan(0);
        for (const word of ["lost", "failed", "fail", "broke", "broken", "missed", "sorry"]) {
          expect(message).not.toContain(word);
        }
      }
    }
  });
});

describe("climbTotals", () => {
  const log = [day("2026-09-09", 1, 4, 3), day("2026-09-09", 2, 3, 1), day("2026-09-10", 1, 7, 5)];

  it("adds up solves and clean solves", () => {
    expect(climbTotals(log)).toMatchObject({ solves: 14, cleanSolves: 9 });
  });

  it("counts distinct days climbed", () => {
    expect(climbTotals(log).daysClimbed).toBe(2);
  });

  it("finds the best day by summing every camp in it", () => {
    // 9 September is 4 + 3 = 7, matching 10 September's single 7.
    expect(climbTotals(log).bestDaySolves).toBe(7);
  });

  it("reads an empty log as all zeroes rather than -Infinity", () => {
    expect(climbTotals([])).toEqual({
      daysClimbed: 0,
      solves: 0,
      cleanSolves: 0,
      bestDaySolves: 0,
    });
  });

  it("does not count a day whose rows are all empty", () => {
    expect(climbTotals([day("2026-09-09", 1, 0)]).daysClimbed).toBe(0);
  });
});

describe("campBestDay", () => {
  const log = [day("2026-09-09", 1, 4), day("2026-09-10", 1, 7), day("2026-09-10", 2, 3)];

  it("finds the most solves in one day at that camp", () => {
    expect(campBestDay(log, 1)).toBe(7);
    expect(campBestDay(log, 2)).toBe(3);
  });

  it("is zero for a camp never visited", () => {
    expect(campBestDay(log, 4)).toBe(0);
    expect(campBestDay([], 1)).toBe(0);
  });
});
