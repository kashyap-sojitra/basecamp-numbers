import { afterEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ClimbLog } from "./ClimbLog";
import { forgetSeenBadgesSnapshot, writeSeenBadges } from "@/lib/progress/seenBadges";
import { localDateSchema, todayLocalDate, type LocalDate } from "@/lib/domain/localDate";
import { DAILY_GOAL, type ClimbDay } from "@/lib/domain/streak";
import { NO_PROGRESS, type LearnerProgress } from "@/lib/domain/progress";
import { MASTERY_MAX } from "@/lib/domain/mastery";
import type { ClimberProfile } from "@/lib/domain/onboarding";
import type { CampNumber } from "@/lib/domain/camp";

const SERVER_DAY: LocalDate = localDateSchema.parse("2020-01-01");
const today = todayLocalDate();
const PROFILE: ClimberProfile = { gradeBand: "k-1", interestTheme: "jungle" };

function daysAgo(back: number): LocalDate {
  const ms = new Date(`${today}T00:00:00Z`).getTime() - back * 86_400_000;
  return localDateSchema.parse(new Date(ms).toISOString().slice(0, 10));
}

const day = (date: LocalDate, camp: CampNumber, solves: number, clean = solves): ClimbDay => ({
  date,
  band: PROFILE.gradeBand,
  camp,
  solves,
  cleanSolves: clean,
});

function climbsWith(progress: LearnerProgress, checkpointsPassed = 0) {
  const empty = { progress: NO_PROGRESS, checkpointsPassed: 0 };
  return {
    "k-1": PROFILE.gradeBand === "k-1" ? { progress, checkpointsPassed } : empty,
    "2-3": empty,
    "4-5": empty,
  } as const;
}

function logFor(
  days: readonly ClimbDay[],
  progress: LearnerProgress = NO_PROGRESS,
  checkpointsPassed = 0,
) {
  return render(
    <ClimbLog
      profile={PROFILE}
      progress={progress}
      climbs={climbsWith(progress, checkpointsPassed)}
      days={days}
      checkpointsPassed={checkpointsPassed}
      serverToday={SERVER_DAY}
    />,
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

afterEach(() => {
  window.localStorage.clear();
  forgetSeenBadgesSnapshot();
});

describe("ClimbLog: the page", () => {
  it("names itself and offers the way back to the mountain", () => {
    logFor([]);
    expect(
      screen.getByRole("heading", { name: "Everything you have climbed" }),
    ).toBeInTheDocument();
    // The way back lives in the app bar now, which the log renders above itself.
    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map");
  });
});

describe("ClimbLog: the streak", () => {
  it("invites a first climb when nothing has been done", () => {
    logFor([]);
    expect(screen.getByText("Streak resting")).toBeInTheDocument();
    expect(screen.getByText("Climb today to start your streak.")).toBeInTheDocument();
    expect(screen.getByText("0 days in a row")).toBeInTheDocument();
  });

  it("shows a live streak and counts today's progress towards the goal", () => {
    logFor([day(today, 1, 2)]);
    expect(screen.getByText("Streak going")).toBeInTheDocument();
    expect(screen.getByText("1 day in a row")).toBeInTheDocument();
    // "2" also appears as a camp number, so read the tally in its own panel.
    const todayPanel = screen.getByText("Today").parentElement;
    expect(todayPanel).not.toBeNull();
    if (todayPanel === null) return;
    expect(within(todayPanel).getByText("2")).toBeInTheDocument();
    expect(within(todayPanel).getByText(`/${String(DAILY_GOAL)}`)).toBeInTheDocument();
  });

  it("ticks the day off once the goal is met", () => {
    logFor([day(today, 1, DAILY_GOAL)]);
    expect(screen.getByText("✅")).toBeInTheDocument();
  });
});

describe("ClimbLog: the calendar", () => {
  it("shows the last fortnight", () => {
    logFor([]);
    const calendar = screen.getByRole("list", { name: "The last two weeks" });
    expect(within(calendar).getAllByRole("listitem")).toHaveLength(14);
  });

  it("spells each day out for a screen reader, climbed or not", () => {
    logFor([day(today, 1, 3)]);
    expect(screen.getByText(`${today}: 3 problems solved, today`)).toBeInTheDocument();
    expect(screen.getByText(`${daysAgo(1)}: 0 problems solved`)).toBeInTheDocument();
  });

  it("sums a day across camps", () => {
    logFor([day(today, 1, 2), day(today, 3, 4)]);
    expect(screen.getByText(`${today}: 6 problems solved, today`)).toBeInTheDocument();
  });
});

describe("ClimbLog: badges", () => {
  it("shows all seven, with none earned for a new climber", () => {
    logFor([]);
    expect(screen.getByText("0 of 7 earned")).toBeInTheDocument();
    expect(screen.getByText("First Steps")).toBeInTheDocument();
    expect(screen.getByText("Summiteer")).toBeInTheDocument();
  });

  it("gives an unearned badge a progress bar and its condition", () => {
    logFor([]);
    expect(screen.getByRole("progressbar", { name: "Century progress" })).toBeInTheDocument();
    expect(screen.getByText("Solve 100 problems")).toBeInTheDocument();
  });

  it("counts the ones earned", () => {
    logFor([day(today, 1, 3)], mastered([1]), 1);
    expect(screen.getByText("3 of 7 earned")).toBeInTheDocument();
  });

  it("spotlights a badge earned since this browser last looked", () => {
    logFor([day(today, 1, 3)], mastered([1]));
    expect(screen.getByRole("status")).toHaveTextContent("2 new badges since last time!");
    expect(screen.getAllByText("New")).toHaveLength(2);
  });

  it("uses the singular for one new badge", () => {
    logFor([day(today, 1, 3)]);
    expect(screen.getByRole("status")).toHaveTextContent("1 new badge since last time!");
  });

  it("settles down on the next visit", () => {
    writeSeenBadges(JSON.stringify(["first-climb", "camp-mastered"]));
    forgetSeenBadgesSnapshot();
    logFor([day(today, 1, 3)], mastered([1]));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("New")).not.toBeInTheDocument();
  });

  it("spotlights only what is actually new", () => {
    writeSeenBadges(JSON.stringify(["first-climb"]));
    forgetSeenBadgesSnapshot();
    logFor([day(today, 1, 3)], mastered([1]));
    expect(screen.getAllByText("New")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("1 new badge since last time!");
  });

  it("says nothing when nothing has been earned at all", () => {
    logFor([]);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("ClimbLog: bests and totals", () => {
  it("shows a best day and a meter for every camp", () => {
    logFor([day(today, 1, 7)], mastered([1]));
    expect(screen.getByRole("heading", { name: /Your best day at each camp/ })).toBeInTheDocument();
    expect(screen.getAllByText("best day")).toHaveLength(4);
    expect(screen.getByText("Meter 100/100")).toBeInTheDocument();
  });

  it("shows this grade's badges from nothing when another grade did the climbing", () => {
    const other: ClimbDay[] = [{ ...day(today, 1, 8), band: "2-3" }];
    logFor(other);
    expect(screen.getByText("0 of 7 earned")).toBeInTheDocument();
    // ...while the streak, which is the child's, still counts that day.
    expect(screen.getByText("1 day in a row")).toBeInTheDocument();
  });

  it("lays every climbed grade out side by side, with its four camps", () => {
    const other: ClimbDay[] = [{ ...day(today, 1, 8), band: "2-3" }];
    const { container } = logFor(other);
    const grades = container.querySelectorAll("[data-grade]");
    // The grade being climbed (K-1) and the one with rows (2-3); 4-5 is untouched.
    expect(Array.from(grades).map((el) => el.getAttribute("data-grade"))).toEqual(["k-1", "2-3"]);
    expect(screen.getByText("Climbing now")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Grade 2–3 camps" }).children).toHaveLength(4);
    expect(screen.getByText(/8 solved · 8 right first time/)).toBeInTheDocument();
  });

  it("adds up the totals: this grade's solves, every grade's solves, days and streak", () => {
    logFor([day(daysAgo(3), 1, 4, 3), day(today, 2, 6, 5)]);
    const totals = screen.getByRole("region", { name: "Totals" });
    // Both days are in the grade being climbed, so both solve totals read 10.
    expect(within(totals).getAllByText("10")).toHaveLength(2);
    expect(within(totals).getByText(/solved in grade K–1/)).toBeInTheDocument();
    expect(within(totals).getByText("solved, every grade")).toBeInTheDocument();
    // Two days climbed, three days apart: no streak longer than one.
    expect(within(totals).getByText("2")).toBeInTheDocument();
    expect(within(totals).getByText("1")).toBeInTheDocument();
  });

  it("keeps another grade's solves out of this grade's total but in the overall one", () => {
    logFor([{ ...day(today, 1, 6), band: "4-5" }, day(daysAgo(1), 2, 4)]);
    const totals = screen.getByRole("region", { name: "Totals" });
    expect(within(totals).getByText("4")).toBeInTheDocument();
    expect(within(totals).getAllByText("10")).toHaveLength(1);
  });

  it("reads an empty log as zeroes rather than blanks", () => {
    logFor([]);
    const totals = screen.getByRole("region", { name: "Totals" });
    expect(within(totals).getAllByText("0")).toHaveLength(4);
  });
});
