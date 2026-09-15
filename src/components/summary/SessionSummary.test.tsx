import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionSummary } from "./SessionSummary";
import { buildSessionSummary } from "@/lib/domain/sessionSummary";
import { NO_PROGRESS, type LearnerProgress } from "@/lib/domain/progress";
import { MASTERY_MAX } from "@/lib/domain/mastery";
import { STAR_EFFORT } from "@/lib/domain/stars";
import type { Milestone } from "@/lib/domain/milestones";
import type { ClimberProfile } from "@/lib/domain/onboarding";
import type { CampNumber } from "@/lib/domain/camp";
import { jsonBodyOf } from "@test/requests";

const fetchMock = vi.fn<typeof fetch>();
const PROFILE: ClimberProfile = { gradeBand: "2-3", interestTheme: "space" };

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

function summaryFor(
  solved: number,
  cleanSolves: number,
  mastery = 56,
  before: LearnerProgress = NO_PROGRESS,
  milestones: readonly Milestone[] = [],
) {
  const onKeepGoing = vi.fn();
  const view = render(
    <SessionSummary
      summary={buildSessionSummary(before, 1, { solved, cleanSolves }, mastery)}
      campName="Trailhead"
      skill="jumps inside a ten"
      profile={PROFILE}
      milestones={milestones}
      slips={[]}
      onKeepGoing={onKeepGoing}
    />,
  );
  return { ...view, onKeepGoing };
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({ want: "summary", summary: { line: "You got sharper.", source: "template" } }),
      { status: 200 },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
});

describe("SessionSummary: the stars", () => {
  it("announces the rating as a picture with a label", () => {
    summaryFor(STAR_EFFORT, STAR_EFFORT);
    expect(screen.getByRole("img", { name: "3 of 3 stars" })).toBeInTheDocument();
  });

  it("rates a quiet sitting without punishing it", () => {
    summaryFor(1, 0);
    expect(screen.getByRole("img", { name: "1 of 3 stars" })).toBeInTheDocument();
    expect(screen.getByText("1 solved. Every jump counts.")).toBeInTheDocument();
  });

  it("says something kind even for an empty sitting", () => {
    summaryFor(0, 0, 0);
    expect(screen.getByRole("img", { name: "0 of 3 stars" })).toBeInTheDocument();
    expect(screen.getByText("No problems this time — the mountain will keep.")).toBeInTheDocument();
  });

  it("names the camp that was climbed", () => {
    summaryFor(3, 3);
    expect(screen.getByRole("heading", { name: "Trailhead" })).toBeInTheDocument();
    expect(screen.getByText("Session complete")).toBeInTheDocument();
  });
});

describe("SessionSummary: the meters", () => {
  it("shows every camp, before and after", () => {
    summaryFor(4, 4);
    expect(screen.getByRole("heading", { name: "Your meters" })).toBeInTheDocument();
    expect(screen.getAllByRole("meter")).toHaveLength(4);
    expect(screen.getByText("Camp 1 · Trailhead")).toBeInTheDocument();
    expect(screen.getByText("Camp 4 · The Summit")).toBeInTheDocument();
  });

  it("marks the camp that was practised today", () => {
    summaryFor(4, 4);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("shows the gain on the camp that rose", () => {
    summaryFor(4, 4, 56);
    // "56" appears both in the delta and on the meter's own readout.
    expect(screen.getAllByText("56").length).toBeGreaterThan(0);
    expect(screen.getByText("(+56)")).toBeInTheDocument();
    expect(screen.getAllByRole("meter")[0]).toHaveAttribute("aria-valuenow", "56");
  });

  it("shows an earlier camp slipping because of this sitting", () => {
    const before = progressOf(0, { 1: { earned: MASTERY_MAX, touchedAtSolve: 0 } });
    render(
      <SessionSummary
        summary={buildSessionSummary(before, 2, { solved: 40, cleanSolves: 40 }, 60)}
        campName="Pine Ridge"
        skill="jumps across a ten"
        profile={PROFILE}
        milestones={[]}
        slips={[]}
        onKeepGoing={vi.fn()}
      />,
    );
    expect(screen.getByText(/Gone dim — a checkpoint will bring it back./)).toBeInTheDocument();
  });
});

describe("SessionSummary: what was new", () => {
  const milestones: readonly Milestone[] = [
    {
      id: "personal-best",
      glyph: "🏅",
      headline: "New personal best",
      detail: "8 problems at Trailhead in one day — your most yet.",
    },
    {
      id: "badge-camp-mastered",
      glyph: "⛺",
      headline: "Badge earned: Camp Master",
      detail: "Fill a camp's Mastery Meter",
    },
  ];

  it("lists what this sitting crossed", () => {
    summaryFor(8, 8, 100, NO_PROGRESS, milestones);
    expect(screen.getByRole("heading", { name: "New today" })).toBeInTheDocument();
    expect(screen.getByText("New personal best")).toBeInTheDocument();
    expect(screen.getByText("Badge earned: Camp Master")).toBeInTheDocument();
  });

  it("says nothing at all when nothing was crossed", () => {
    summaryFor(3, 3);
    expect(screen.queryByRole("heading", { name: "New today" })).not.toBeInTheDocument();
  });
});

describe("SessionSummary: the coach's line", () => {
  it("shows a loader until the words arrive, never a blank space", () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));
    summaryFor(4, 4);
    expect(screen.getByLabelText("Writing your word problem")).toBeInTheDocument();
  });

  it("shows the line once it lands", async () => {
    summaryFor(4, 4);
    expect(await screen.findByText("You got sharper.")).toBeInTheDocument();
  });

  it("asks for a summary, describing the sitting without numbers", async () => {
    summaryFor(4, 4);
    await screen.findByText("You got sharper.");
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/coach");
    const body = jsonBodyOf(init) as { want: string; request: { skill: string } };
    expect(body.want).toBe("summary");
    expect(body.request.skill).toBe("jumps inside a ten");
  });
});

describe("SessionSummary: where to next", () => {
  it("offers to keep climbing here", async () => {
    const user = userEvent.setup();
    const { onKeepGoing } = summaryFor(4, 4);
    await user.click(screen.getByRole("button", { name: "Keep climbing here" }));
    expect(onKeepGoing).toHaveBeenCalledOnce();
  });

  it("offers the map and the progress page", () => {
    summaryFor(4, 4);
    expect(screen.getByRole("link", { name: "Back to the map" })).toHaveAttribute("href", "/map");
    // The summary's own button and the app bar's pill both go there; assert
    // the destination of each rather than that there is exactly one.
    const logLinks = screen.getAllByRole("link", { name: /My progress/ });
    expect(logLinks.length).toBeGreaterThan(0);
    for (const link of logLinks) expect(link).toHaveAttribute("href", "/log");
  });
});
