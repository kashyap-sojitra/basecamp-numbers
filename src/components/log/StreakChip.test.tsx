import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StreakChip } from "./StreakChip";
import { DAILY_GOAL, type ClimbDay } from "@/lib/domain/streak";
import { localDateSchema, todayLocalDate, type LocalDate } from "@/lib/domain/localDate";

const SERVER_DAY: LocalDate = localDateSchema.parse("2020-01-01");

/** Today, as the browser sees it — which is what the chip reads. */
const today = todayLocalDate();

function dayFor(date: LocalDate, solves: number): ClimbDay {
  return { date, band: "2-3", camp: 1, solves, cleanSolves: solves };
}

/** The local day `back` days before today. */
function daysAgo(back: number): LocalDate {
  const ms = new Date(`${today}T00:00:00Z`).getTime() - back * 86_400_000;
  return localDateSchema.parse(new Date(ms).toISOString().slice(0, 10));
}

describe("StreakChip", () => {
  it("invites the child into the log when there is no streak yet", () => {
    render(<StreakChip days={[]} serverToday={SERVER_DAY} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/log");
    expect(link).toHaveAccessibleName("No streak yet. Open your progress.");
  });

  it("shows the streak's length once it is running", () => {
    render(<StreakChip days={[dayFor(today, 3)]} serverToday={SERVER_DAY} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("day")).toBeInTheDocument();
  });

  it("pluralises correctly past one day", () => {
    const days = [dayFor(daysAgo(1), 3), dayFor(today, 3)];
    render(<StreakChip days={days} serverToday={SERVER_DAY} />);
    expect(screen.getByText("days")).toBeInTheDocument();
  });

  it("counts down what today still needs, for a child mid-climb", () => {
    render(<StreakChip days={[dayFor(today, 1)]} serverToday={SERVER_DAY} />);
    expect(screen.getByText(`${String(DAILY_GOAL - 1)} to go`)).toBeInTheDocument();
  });

  it("stops counting down once the day's climb is done", () => {
    render(<StreakChip days={[dayFor(today, DAILY_GOAL)]} serverToday={SERVER_DAY} />);
    expect(screen.queryByText(/to go/)).not.toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAccessibleName(/Today's climb is done/);
  });

  it("spells the whole state out in the link's label, not just the number", () => {
    render(<StreakChip days={[dayFor(today, 1)]} serverToday={SERVER_DAY} />);
    expect(screen.getByRole("link")).toHaveAccessibleName(
      `1-day streak. ${String(DAILY_GOAL - 1)} more problems today for a full climb. Open your progress.`,
    );
  });

  it("goes warm only for a live streak, since that is a reward", () => {
    const live = render(<StreakChip days={[dayFor(today, 2)]} serverToday={SERVER_DAY} />);
    expect(screen.getByRole("link").className).toContain("reward");
    live.unmount();
    render(<StreakChip days={[]} serverToday={SERVER_DAY} />);
    expect(screen.getByRole("link").className).not.toContain("reward");
  });

  it("meets the 44px tap target", () => {
    render(<StreakChip days={[]} serverToday={SERVER_DAY} />);
    expect(screen.getByRole("link")).toHaveClass("min-h-11");
  });
});
