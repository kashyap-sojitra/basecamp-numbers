import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CampCardBody, LockGlyph } from "./CampCardBody";
import type { Camp, CampProgress } from "@/lib/domain/camp";
import { CAMP_DEFINITIONS } from "@/lib/data/camps";

function campWith(progress: CampProgress, index = 0): Camp {
  const definition = CAMP_DEFINITIONS[index];
  if (definition === undefined) throw new Error("no such camp");
  return { ...definition, progress };
}

describe("CampCardBody: what every camp says", () => {
  it("names the camp, its number, its skill and its mechanic", () => {
    render(<CampCardBody camp={campWith({ status: "open", mastery: 0, earned: 0 })} band="2-3" />);
    expect(screen.getByText("Camp 1")).toBeInTheDocument();
    expect(screen.getByText("Trailhead")).toBeInTheDocument();
    expect(screen.getByText("Add and subtract in small steps")).toBeInTheDocument();
    expect(screen.getByText("Number-line jump")).toBeInTheDocument();
  });
});

describe("CampCardBody: an open camp", () => {
  const camp = campWith({ status: "open", mastery: 42, earned: 42 });

  it("shows the meter and a way in", () => {
    render(<CampCardBody camp={camp} band="2-3" />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "42");
    expect(screen.getByRole("link", { name: "Climb" })).toHaveAttribute("href", "/camp/1");
  });

  it("gives the way in a 44px tap target", () => {
    render(<CampCardBody camp={camp} band="2-3" />);
    expect(screen.getByRole("link", { name: "Climb" })).toHaveClass("min-h-11");
  });

  it("says nothing about dimming when the camp is fresh", () => {
    render(<CampCardBody camp={camp} band="2-3" />);
    expect(screen.queryByText("Gone dim")).not.toBeInTheDocument();
  });
});

describe("CampCardBody: a dimmed but open camp", () => {
  it("says it has gone dim, visibly rather than subtly", () => {
    render(<CampCardBody camp={campWith({ status: "open", mastery: 60, earned: 100 })} band="2-3" />);
    expect(screen.getByText("Gone dim")).toBeInTheDocument();
  });

  it("still lets the child climb it", () => {
    render(<CampCardBody camp={campWith({ status: "open", mastery: 60, earned: 100 })} band="2-3" />);
    expect(screen.getByRole("link", { name: "Climb" })).toBeInTheDocument();
  });

  it("offers its own review on its own card — the one place besides the banner", () => {
    render(<CampCardBody camp={campWith({ status: "open", mastery: 60, earned: 100 })} band="2-3" />);
    const review = screen.getByRole("link", { name: "Start checkpoint" });
    expect(review).toHaveAttribute("href", "/checkpoint/1");
    expect(review).toHaveClass("min-h-11");
  });

  it("offers no review while it is only a little dim", () => {
    render(<CampCardBody camp={campWith({ status: "open", mastery: 85, earned: 100 })} band="2-3" />);
    expect(screen.queryByRole("link", { name: /checkpoint|warm-up/i })).not.toBeInTheDocument();
  });

  it("calls the review a warm-up for K-1", () => {
    render(<CampCardBody camp={campWith({ status: "open", mastery: 60, earned: 100 })} band="k-1" />);
    expect(screen.getByRole("link", { name: "Start warm-up" })).toHaveAttribute("href", "/checkpoint/1");
  });
});

describe("CampCardBody: a gated camp", () => {
  const camp = campWith({ status: "checkpoint", mastery: 80, earned: 100, reviewOf: 1 }, 2);

  it("names the camp that must be reviewed", () => {
    render(<CampCardBody camp={camp} band="2-3" />);
    expect(
      screen.getByText("Camp 1 has gone dim — review it to climb on."),
    ).toBeInTheDocument();
  });

  it("says whom to see first, in words, and offers no link into another camp's questions", () => {
    render(<CampCardBody camp={camp} band="2-3" />);
    expect(screen.getByText("Review Camp 1 first")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("offers no ordinary way in, so the review cannot be skipped", () => {
    render(<CampCardBody camp={camp} band="2-3" />);
    expect(screen.queryByRole("link", { name: "Climb" })).not.toBeInTheDocument();
  });

  it("says it the K-1 way", () => {
    render(<CampCardBody camp={camp} band="k-1" compact />);
    expect(screen.getByText("Warm up Camp 1 first")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

describe("CampCardBody: a locked camp", () => {
  const camp = campWith({ status: "locked", unlocksAfter: 1 }, 1);

  it("says what opens it", () => {
    render(<CampCardBody camp={camp} band="2-3" />);
    expect(screen.getByText(/Finish Camp 1 to open/)).toBeInTheDocument();
  });

  it("shows no meter, because a locked camp has none", () => {
    render(<CampCardBody camp={camp} band="2-3" />);
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });

  it("offers no link at all", () => {
    render(<CampCardBody camp={camp} band="2-3" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("LockGlyph", () => {
  it("is decorative, since the words beside it carry the meaning", () => {
    const { container } = render(<LockGlyph />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("takes a size from its caller", () => {
    const { container } = render(<LockGlyph className="size-3" />);
    expect(container.querySelector("svg")).toHaveClass("size-3");
  });
});
