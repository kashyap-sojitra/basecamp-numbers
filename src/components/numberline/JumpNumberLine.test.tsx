import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JumpNumberLine, MIN_TICK_PX, TICK_INSET, arcGeometry } from "./JumpNumberLine";
import { INTEREST_PALETTES } from "@/lib/theme/interestTheme";
import type { JumpProblem } from "@/lib/domain/numberLine";

const problem: JumpProblem = {
  index: 0,
  operation: "add",
  start: 8,
  change: 7,
  answer: 15,
  line: { min: 0, max: 20 },
};

const palette = INTEREST_PALETTES.space;

function lineFor(
  state: Parameters<typeof JumpNumberLine>[0]["state"] = { kind: "awaiting" },
  onLand = vi.fn<(value: number) => void>(),
) {
  const view = render(
    <JumpNumberLine problem={problem} state={state} palette={palette} onLand={onLand} />,
  );
  return { ...view, onLand };
}

describe("arcGeometry", () => {
  it("draws from the start tick to the landing tick along the baseline", () => {
    const arc = arcGeometry(10, 100, 80);
    expect(arc.d.startsWith("M 10 ")).toBe(true);
    expect(arc.d).toContain(" 100 ");
  });

  it("keeps the whole arc inside the lane it is given", () => {
    for (const height of [20, 40, 80, 160]) {
      for (const span of [1, 20, 200, 900]) {
        const arc = arcGeometry(0, span, height);
        expect(arc.baseline).toBeGreaterThan(0);
        expect(arc.baseline).toBeLessThanOrEqual(height);
        expect(arc.apexY).toBeGreaterThanOrEqual(0);
        expect(arc.apexY).toBeLessThan(arc.baseline);
      }
    }
  });

  it("arches higher for a longer jump", () => {
    expect(arcGeometry(0, 300, 120).apex).toBeGreaterThan(arcGeometry(0, 30, 120).apex);
  });

  it("still draws something in a lane too short to arch in", () => {
    const arc = arcGeometry(0, 100, 4);
    expect(arc.apex).toBeGreaterThan(0);
    expect(arc.d).not.toContain("NaN");
  });

  it("draws a backwards jump as readily as a forwards one", () => {
    const back = arcGeometry(200, 20, 80);
    expect(back.d.startsWith("M 200 ")).toBe(true);
    expect(back.apex).toBeGreaterThan(0);
  });

  it("never produces a path with NaN in it, whatever it is handed", () => {
    for (const [a, b, h] of [[0, 0, 0], [-5, -50, 10], [0.5, 10.25, 33.7]] as const) {
      expect(arcGeometry(a, b, h).d).not.toContain("NaN");
    }
  });
});

describe("JumpNumberLine: the line itself", () => {
  it("draws one tick per integer, inclusive of both ends", () => {
    lineFor();
    expect(screen.getAllByRole("button")).toHaveLength(21);
    expect(screen.getByRole("button", { name: "Land on 0" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Land on 20" })).toBeInTheDocument();
  });

  it("explains itself, keyboard and all, as one group", () => {
    lineFor();
    expect(
      screen.getByRole("group", {
        name: "Number line from 0 to 20. Use the arrow keys to move along it, then press Enter to land.",
      }),
    ).toBeInTheDocument();
  });

  it("labels every tick for a screen reader, not just the numbered ones", () => {
    lineFor();
    for (let value = 0; value <= 20; value += 1) {
      expect(screen.getByRole("button", { name: `Land on ${String(value)}` })).toBeInTheDocument();
    }
  });

  it("gives every tick the full 44px of height", () => {
    lineFor();
    for (const tick of screen.getAllByRole("button")) {
      expect(tick).toHaveClass("min-h-11");
    }
  });

  it("reserves at least MIN_TICK_PX per tick, so they never shrink below it", () => {
    const { container } = lineFor();
    const track = container.querySelector('[style*="min-width"]');
    expect(track).not.toBeNull();
    expect(track?.getAttribute("style")).toContain(`${String(21 * MIN_TICK_PX)}px`);
  });

  it("insets the arc lane to line up with the first tick", () => {
    expect(TICK_INSET).toBeGreaterThan(0);
  });
});

describe("JumpNumberLine: landing", () => {
  it("reports the value the child tapped", async () => {
    const user = userEvent.setup();
    const { onLand } = lineFor();
    await user.click(screen.getByRole("button", { name: "Land on 15" }));
    expect(onLand).toHaveBeenCalledWith(15);
  });

  it("accepts a tap anywhere in the tick's column, not only on the mark", async () => {
    const user = userEvent.setup();
    const { onLand } = lineFor();
    // The number itself is inside the button, so tapping it lands too.
    await user.click(screen.getByText("10"));
    expect(onLand).toHaveBeenCalledWith(10);
  });

  it("stops accepting taps once the jump is resolved", async () => {
    const user = userEvent.setup();
    const { onLand } = lineFor({ kind: "landed", landed: 15, correct: true });
    const tick = screen.getByRole("button", { name: "Land on 3" });
    expect(tick).toBeDisabled();
    await user.click(tick);
    expect(onLand).not.toHaveBeenCalled();
  });
});

describe("JumpNumberLine: the keyboard", () => {
  it("is one tab stop, not twenty-one", () => {
    lineFor();
    const focusable = screen.getAllByRole("button").filter((tick) => tick.tabIndex === 0);
    expect(focusable).toHaveLength(1);
  });

  it("puts the roving focus at the low end of the line", () => {
    lineFor();
    expect(screen.getByRole("button", { name: "Land on 0" }).tabIndex).toBe(0);
  });

  it("moves along the line with the arrow keys", async () => {
    const user = userEvent.setup();
    lineFor();
    await user.tab();
    expect(screen.getByRole("button", { name: "Land on 0" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Land on 1" })).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Land on 1" })).toHaveFocus();
  });

  it("treats up and down like right and left, for a vertical thinker", async () => {
    const user = userEvent.setup();
    lineFor();
    await user.tab();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(screen.getByRole("button", { name: "Land on 2" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Land on 1" })).toHaveFocus();
  });

  it("strides five at a time with shift held", async () => {
    const user = userEvent.setup();
    lineFor();
    await user.tab();
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(screen.getByRole("button", { name: "Land on 5" })).toHaveFocus();
  });

  it("follows the focus as the child moves, keeping one tab stop", async () => {
    const user = userEvent.setup();
    lineFor();
    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    const focusable = screen.getAllByRole("button").filter((tick) => tick.tabIndex === 0);
    expect(focusable).toHaveLength(1);
    expect(focusable[0]).toHaveAccessibleName("Land on 2");
  });

  it("jumps to either end with Home and End", async () => {
    const user = userEvent.setup();
    lineFor();
    await user.tab();
    await user.keyboard("{Home}");
    expect(screen.getByRole("button", { name: "Land on 0" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("button", { name: "Land on 20" })).toHaveFocus();
  });

  it("stops at the ends rather than wrapping around the line", async () => {
    const user = userEvent.setup();
    lineFor();
    await user.tab();
    await user.keyboard("{Home}{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Land on 0" })).toHaveFocus();
    await user.keyboard("{End}{ArrowRight}");
    expect(screen.getByRole("button", { name: "Land on 20" })).toHaveFocus();
  });

  it("lands with Enter", async () => {
    const user = userEvent.setup();
    const { onLand } = lineFor();
    await user.tab();
    await user.keyboard("{ArrowRight}{Enter}");
    expect(onLand).toHaveBeenCalledWith(1);
  });

  it("lands with the space bar too, as a button should", async () => {
    const user = userEvent.setup();
    const { onLand } = lineFor();
    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}[Space]");
    expect(onLand).toHaveBeenCalledWith(2);
  });

  it("ignores keys it has no business handling", async () => {
    const user = userEvent.setup();
    lineFor();
    await user.tab();
    await user.keyboard("{PageDown}a");
    expect(screen.getByRole("button", { name: "Land on 0" })).toHaveFocus();
  });
});

describe("JumpNumberLine: what the overlays may not do", () => {
  it("never lets a decorative layer swallow a tap", () => {
    const { container } = lineFor({ kind: "landed", landed: 15, correct: true });
    for (const layer of container.querySelectorAll("svg, [aria-hidden='true']")) {
      const hasPointerEvents = layer.closest(".pointer-events-none") !== null;
      const isInsideButton = layer.closest("button") !== null;
      expect(hasPointerEvents || isInsideButton).toBe(true);
    }
  });
});

describe("JumpNumberLine: measuring and scrolling itself", () => {
  /** A ResizeObserver that reports a size as soon as it is asked to observe. */
  function observeWith(width: number, height: number): void {
    class FiringResizeObserver implements ResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(): void {
        this.callback([{ contentRect: { width, height } } as ResizeObserverEntry], this);
      }
      unobserve(): void {
        /* nothing to stop */
      }
      disconnect(): void {
        /* nothing to stop */
      }
    }
    vi.stubGlobal("ResizeObserver", FiringResizeObserver);
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("draws the arc once it knows how big its lane is", () => {
    observeWith(800, 90);
    const { container } = lineFor({ kind: "landed", landed: 15, correct: true });
    const path = container.querySelector("path");
    if (path === null) throw new Error("no arc drawn");
    const d = path.getAttribute("d") ?? "";
    expect(d).toMatch(/^M [\d.]+ [\d.]+ Q/);
    expect(d).not.toContain("NaN");
  });

  it("draws no arc while the lane has no size yet", () => {
    observeWith(0, 0);
    const { container } = lineFor({ kind: "landed", landed: 15, correct: true });
    expect(container.querySelector("path")).toBeNull();
  });

  it("ignores a sub-pixel wobble rather than re-rendering for ever", () => {
    // Two reports of the same rounded size must settle, not loop.
    class WobblingObserver implements ResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(): void {
        for (const width of [800.2, 800.4, 799.6]) {
          this.callback([{ contentRect: { width, height: 90 } } as ResizeObserverEntry], this);
        }
      }
      unobserve(): void {
        /* nothing to stop */
      }
      disconnect(): void {
        /* nothing to stop */
      }
    }
    vi.stubGlobal("ResizeObserver", WobblingObserver);
    expect(() => lineFor({ kind: "landed", landed: 15, correct: true })).not.toThrow();
  });

  it("brings the current jump into view when the line is wider than the screen", async () => {
    const scrollTo = vi.fn();
    // jsdom lays nothing out, so the overflow has to be stated.
    vi.spyOn(Element.prototype, "scrollWidth", "get").mockReturnValue(2_000);
    vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(400);
    vi.spyOn(Element.prototype, "scrollTo").mockImplementation(scrollTo);
    lineFor();
    await vi.waitFor(() => { expect(scrollTo).toHaveBeenCalled(); });
    const [options] = scrollTo.mock.calls[0] as [{ left: number; behavior: string }];
    expect(options.left).toBeGreaterThanOrEqual(0);
    expect(options.behavior).toBe("smooth");
  });

  it("shows the faded edges only when there is more line to find", async () => {
    vi.spyOn(Element.prototype, "scrollWidth", "get").mockReturnValue(2_000);
    vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(400);
    vi.spyOn(Element.prototype, "scrollTo").mockImplementation(() => undefined);
    const { container } = lineFor();
    await vi.waitFor(() => {
      expect(container.querySelectorAll(".pointer-events-none").length).toBeGreaterThan(0);
    });
  });

  it("does not scroll a line that already fits", async () => {
    const scrollTo = vi.fn();
    vi.spyOn(Element.prototype, "scrollWidth", "get").mockReturnValue(400);
    vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(400);
    vi.spyOn(Element.prototype, "scrollTo").mockImplementation(scrollTo);
    lineFor();
    await new Promise((resolve) => { requestAnimationFrame(() => { resolve(null); }); });
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
