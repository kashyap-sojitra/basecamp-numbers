import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { AdventureMap } from "./AdventureMap";
import { localDateSchema, todayLocalDate, type LocalDate } from "@/lib/domain/localDate";
import { NO_PROGRESS, type LearnerProgress } from "@/lib/domain/progress";
import { CHECKPOINT_QUESTIONS } from "@/lib/domain/decay";
import { MASTERY_MAX } from "@/lib/domain/mastery";
import type { ClimberProfile } from "@/lib/domain/onboarding";
import type { ClimbDay } from "@/lib/domain/streak";
import type { CampNumber } from "@/lib/domain/camp";
import { UPCOMING_CAMPS } from "@/lib/data/camps";
import { MOUNTAIN_FRACTION } from "@/lib/domain/mapLayout";
import userEvent from "@testing-library/user-event";

const TODAY: LocalDate = localDateSchema.parse("2026-09-11");
const PROFILE: ClimberProfile = { gradeBand: "2-3", interestTheme: "ocean" };

function progressOf(
  totalSolves: number,
  camps: Partial<Record<CampNumber, { earned: number; touchedAtSolve: number }>>,
): LearnerProgress {
  return {
    totalSolves,
    camps: {
      1: camps[1] ?? { earned: 0, touchedAtSolve: 0 },
      2: camps[2] ?? { earned: 0, touchedAtSolve: 0 },
      3: camps[3] ?? { earned: 0, touchedAtSolve: 0 },
      4: camps[4] ?? { earned: 0, touchedAtSolve: 0 },
    },
  };
}

function mapFor(progress: LearnerProgress, days: readonly ClimbDay[] = []) {
  return render(
    <AdventureMap profile={PROFILE} progress={progress} days={days} serverToday={TODAY} />,
  );
}

describe("AdventureMap: the header", () => {
  it("names the mountain and the child's picks", () => {
    mapFor(NO_PROGRESS);
    expect(screen.getByRole("heading", { name: "Four camps to the summit" })).toBeInTheDocument();
    expect(screen.getByText("Grade 2–3")).toBeInTheDocument();
    expect(screen.getByText("Ocean")).toBeInTheDocument();
  });

  it("offers a way back to change those picks", () => {
    mapFor(NO_PROGRESS);
    expect(screen.getByRole("link", { name: "Grade & world" })).toHaveAttribute(
      "href",
      "/?change=1",
    );
  });

  it("offers the climb log from the streak chip", () => {
    mapFor(NO_PROGRESS);
    // Named in full: the app bar also carries a "My progress" pill, and this
    // assertion is about the chip being the way in from the header.
    expect(
      screen.getByRole("link", { name: "No streak yet. Open your progress." }),
    ).toHaveAttribute("href", "/log");
  });
});

describe("AdventureMap: a new climber", () => {
  it("says how many camps are open and what opens the next", () => {
    mapFor(NO_PROGRESS);
    expect(
      screen.getByText("1 of 4 camps open. Fill a camp's Mastery Meter to open the next one."),
    ).toBeInTheDocument();
  });

  it("shows no checkpoint banner", () => {
    mapFor(NO_PROGRESS);
    expect(screen.queryByText("Checkpoint needed")).not.toBeInTheDocument();
  });

  it("renders both layouts, so a phone and a laptop each get one", () => {
    const { container } = mapFor(NO_PROGRESS);
    // The route list below xl, the mountain above it. The board needs
    // BOARD_MIN_PX before four cards fit around the fixed markers, which is
    // why this is xl and not md — see mapLayout.ts.
    expect(container.querySelector(".xl\\:hidden")).not.toBeNull();
    expect(container.querySelector(".xl\\:block")).not.toBeNull();
  });
});

describe("AdventureMap: what is coming", () => {
  it("shows camps 5 and 6 as coming soon, in both layouts", () => {
    const { container } = mapFor(NO_PROGRESS);
    // Once on the mountain and once in the route list.
    expect(container.querySelectorAll('[data-upcoming="5"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-upcoming="6"]')).toHaveLength(2);
    for (const camp of UPCOMING_CAMPS) {
      expect(screen.getAllByText(camp.name).length).toBeGreaterThan(0);
      expect(screen.getAllByText(camp.skill).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText("Coming soon").length).toBeGreaterThan(0);
  });

  it("offers no way into a camp that does not exist yet", () => {
    mapFor(NO_PROGRESS);
    for (const camp of UPCOMING_CAMPS) {
      expect(screen.queryByRole("link", { name: new RegExp(camp.name) })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: new RegExp(camp.name) })).not.toBeInTheDocument();
    }
  });

  it("stands the teasers beyond the summit, in a board that scrolls inside a fixed frame", async () => {
    const user = userEvent.setup();
    const { container } = mapFor(NO_PROGRESS);
    const frame = container.querySelector("[data-board-frame]");
    expect(frame).toHaveClass("scroll-sleek");
    // The border is on the frame, not on what scrolls.
    expect(frame).toHaveClass("rounded-[28px]", "border-2");
    const extension = container.querySelector<HTMLElement>("[data-board-extension]");
    const mountain = container.querySelector<HTMLElement>("[data-board-mountain]");
    // Sized from the frame: the mountain is the frame's width, and the
    // extension starts where the mountain ends.
    expect(mountain?.style.width).toBe(`${String(MOUNTAIN_FRACTION * 100)}%`);
    expect(extension?.style.left).toBe(`${String(MOUNTAIN_FRACTION * 100)}%`);
    expect(extension?.querySelectorAll("[data-upcoming]")).toHaveLength(2);
    expect(mountain?.querySelectorAll("[data-upcoming]")).toHaveLength(0);
    expect(container.querySelector('[data-extended="true"]')).toBeInTheDocument();

    // One button takes a child to the next range; it is a real 44px control.
    const next = screen.getByRole("button", { name: /See what's next/ });
    expect(next).toHaveClass("min-h-11");
    await user.click(next);
  });

  it("still counts four camps: the teasers are not camps", () => {
    mapFor(NO_PROGRESS);
    expect(screen.getByRole("heading", { name: "Four camps to the summit" })).toBeInTheDocument();
    expect(screen.getByText(/1 of 4 camps open/)).toBeInTheDocument();
  });
});

describe("AdventureMap: every camp open", () => {
  it("says so, and stops nagging about unlocking", () => {
    const full = progressOf(40, {
      1: { earned: MASTERY_MAX, touchedAtSolve: 40 },
      2: { earned: MASTERY_MAX, touchedAtSolve: 40 },
      3: { earned: MASTERY_MAX, touchedAtSolve: 40 },
      4: { earned: MASTERY_MAX, touchedAtSolve: 40 },
    });
    mapFor(full);
    expect(
      screen.getByText("Every camp is open. Keep their meters full to stay sharp."),
    ).toBeInTheDocument();
  });
});

describe("AdventureMap: a camp gone dim", () => {
  const dimmed = progressOf(500, {
    1: { earned: MASTERY_MAX, touchedAtSolve: 0 },
    2: { earned: MASTERY_MAX, touchedAtSolve: 500 },
  });

  it("announces the checkpoint rather than leaving it to be noticed", () => {
    mapFor(dimmed);
    expect(screen.getByText("Checkpoint needed")).toBeInTheDocument();
    expect(
      screen.getByText("Camp 1 has gone dim while you climbed elsewhere."),
    ).toBeInTheDocument();
  });

  it("says what slipped, by how much, and what it takes to fix", () => {
    mapFor(dimmed);
    const banner = screen.getByText("Checkpoint needed").closest("aside");
    expect(banner).not.toBeNull();
    if (banner === null) return;
    expect(within(banner).getByText(/slipped from 100 to/)).toBeInTheDocument();
    expect(within(banner).getByText(new RegExp(`Answer ${String(CHECKPOINT_QUESTIONS)} questions`))).toBeInTheDocument();
  });

  it("offers a prominent way into the checkpoint, from the banner", () => {
    mapFor(dimmed);
    const banner = screen.getByText("Checkpoint needed").closest("aside");
    expect(banner).not.toBeNull();
    if (banner === null) return;
    expect(within(banner).getByRole("link", { name: "Start checkpoint" })).toHaveAttribute(
      "href",
      "/checkpoint/1",
    );
  });

  it("never lets a higher camp's card open camp 1's questions", () => {
    mapFor(dimmed);
    // Every way into the review names camp 1: the banner, and camp 1's own
    // card in each layout. The gated camps say whom to see and link nowhere.
    const ways = screen.getAllByRole("link", { name: /Start checkpoint/ });
    for (const way of ways) expect(way).toHaveAttribute("href", "/checkpoint/1");
    expect(screen.getAllByText("Review Camp 1 first").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /^Checkpoint$/ })).not.toBeInTheDocument();
  });

  it("explains the block at the foot of the page too", () => {
    mapFor(dimmed);
    expect(
      screen.getByText("Camp 1 needs a checkpoint before you can climb higher."),
    ).toBeInTheDocument();
  });
});

describe("AdventureMap: the streak chip", () => {
  it("shows a live streak in the header", () => {
    // The chip reads the *browser's* day through `useToday`, so the climb has
    // to be dated against the real clock. A literal here silently stops being
    // a live streak once it is more than STREAK_GRACE_DAYS old.
    const days: readonly ClimbDay[] = [
      { date: todayLocalDate(), band: "2-3", camp: 1, solves: 3, cleanSolves: 3 },
    ];
    mapFor(NO_PROGRESS, days);
    expect(screen.getByRole("link", { name: /day streak/ })).toBeInTheDocument();
  });
});
