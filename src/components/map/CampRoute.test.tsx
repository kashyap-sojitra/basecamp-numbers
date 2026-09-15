import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CampRoute } from "./CampRoute";
import { CAMP_DEFINITIONS } from "@/lib/data/camps";
import { campsWithProgress, NO_PROGRESS, type LearnerProgress } from "@/lib/domain/progress";
import { INTEREST_PALETTES } from "@/lib/theme/interestTheme";
import { MASTERY_MAX } from "@/lib/domain/mastery";

const palette = INTEREST_PALETTES.space;

function routeFor(progress: LearnerProgress) {
  return render(
    <CampRoute camps={campsWithProgress(CAMP_DEFINITIONS, progress)} band="2-3" palette={palette} />,
  );
}

describe("CampRoute", () => {
  it("lists the camps as a labelled climb", () => {
    routeFor(NO_PROGRESS);
    expect(screen.getByRole("list", { name: "Your camps, trailhead first" })).toBeInTheDocument();
  });

  it("shows all four camps", () => {
    routeFor(NO_PROGRESS);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    for (const definition of CAMP_DEFINITIONS) {
      expect(screen.getByText(definition.name)).toBeInTheDocument();
    }
  });

  it("puts the summit at the top by reversing the visual order", () => {
    const { container } = routeFor(NO_PROGRESS);
    // The list is in climb order in the DOM and reversed in CSS, so a screen
    // reader hears trailhead first while the eye sees the summit up top.
    expect(container.querySelector("ol")).toHaveClass("flex-col-reverse");
    const first = screen.getAllByRole("listitem")[0];
    expect(first?.textContent).toContain("Trailhead");
  });

  it("offers a way into camp 1 only, for a new climber", () => {
    routeFor(NO_PROGRESS);
    expect(screen.getAllByRole("link", { name: "Climb" })).toHaveLength(1);
    expect(screen.getAllByText(/to open/)).toHaveLength(3);
  });

  it("opens the next camp once the one below is full", () => {
    const progress: LearnerProgress = {
      totalSolves: 8,
      camps: {
        1: { earned: MASTERY_MAX, touchedAtSolve: 8 },
        2: { earned: 0, touchedAtSolve: 0 },
        3: { earned: 0, touchedAtSolve: 0 },
        4: { earned: 0, touchedAtSolve: 0 },
      },
    };
    routeFor(progress);
    expect(screen.getAllByRole("link", { name: "Climb" })).toHaveLength(2);
  });

  it("shows a checkpoint in the list when a camp below has gone dim", () => {
    const progress: LearnerProgress = {
      totalSolves: 500,
      camps: {
        1: { earned: MASTERY_MAX, touchedAtSolve: 0 },
        2: { earned: MASTERY_MAX, touchedAtSolve: 500 },
        3: { earned: 0, touchedAtSolve: 0 },
        4: { earned: 0, touchedAtSolve: 0 },
      },
    };
    routeFor(progress);
    // Camps 2 and 3 sit above the dimmed camp 1, so both are gated: each says
    // whom to see and offers no way into camp 1's questions from its own card.
    expect(screen.getAllByText("Review Camp 1 first")).toHaveLength(2);
    // The review is offered on camp 1's own card, and nowhere else.
    const reviews = screen.getAllByRole("link", { name: "Start checkpoint" });
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toHaveAttribute("href", "/checkpoint/1");
    expect(reviews[0]?.closest("li")?.textContent).toContain("Trailhead");
  });

  it("labels every camp by its number", () => {
    routeFor(NO_PROGRESS);
    for (const number of [1, 2, 3, 4]) {
      expect(screen.getByText(`Camp ${String(number)}`)).toBeInTheDocument();
    }
  });
});
