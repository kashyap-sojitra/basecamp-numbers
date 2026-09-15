import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { AnswerBurst } from "./effects/AnswerBurst";
import { Celebration } from "./effects/Celebration";
import { ClickSparkles } from "./effects/ClickSparkles";
import { CursorGlow } from "./effects/CursorGlow";
import { MasteryMeter } from "./MasteryMeter";
import { WorldScenery } from "./map/WorldScenery";
import { AppLoading } from "./AppLoading";
import { usePointerParallax } from "@/lib/motion/usePointerParallax";

/**
 * `prefers-reduced-motion: reduce` must lose the movement and keep the
 * meaning. Anything purely decorative stops rendering; anything that carries
 * information stays exactly where it was.
 */

function prefersReducedMotion(reduce: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: reduce && query.includes("reduced-motion"),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => {
  prefersReducedMotion(true);
});

afterEach(() => {
  prefersReducedMotion(false);
});

describe("under reduced motion: decoration stops", () => {
  it("Celebration renders no confetti at all", () => {
    const { container } = render(<Celebration variant="rain" fireKey={1} />);
    expect(container.firstChild).toBeNull();
  });

  it("ClickSparkles renders nothing, and stops listening for taps", () => {
    const { container } = render(<ClickSparkles />);
    expect(container.firstChild).toBeNull();
    act(() => { fireEvent.pointerDown(window, { clientX: 10, clientY: 10 }); });
    expect(container.firstChild).toBeNull();
  });

  it("CursorGlow renders nothing, however much the pointer moves", () => {
    const { container } = render(<CursorGlow />);
    act(() => { fireEvent.mouseMove(window, { clientX: 50, clientY: 50 }); });
    expect(container.firstChild).toBeNull();
  });

  it("the world scenery stands still: every sprite is at rest and nothing is on its way", () => {
    const { container } = render(<WorldScenery theme="jungle" />);
    // The picture is still there — the friends still turn up — but no
    // element has been handed a transform to travel from.
    expect(container.querySelectorAll("text").length).toBeGreaterThan(0);
    const moving = Array.from(
      container.querySelectorAll<SVGElement>("g, path, circle, line"),
    ).filter((el) => el.style.transform !== "" && el.style.transform !== "none");
    expect(moving).toHaveLength(0);
  });

  it("the parallax rests at the centre and ignores the pointer", () => {
    let values = { x: 1, y: 1 };
    function Probe() {
      const ref = useRef<HTMLDivElement>(null);
      const { x, y } = usePointerParallax(ref);
      values = { x: x.get(), y: y.get() };
      return <div ref={ref} />;
    }
    render(<Probe />);
    act(() => { fireEvent.mouseMove(window, { clientX: 500, clientY: 500 }); });
    expect(values).toEqual({ x: 0, y: 0 });
  });

  it("AnswerBurst drops the flying emoji", () => {
    // Framer reads the media query once per process, so this file runs
    // entirely under `reduce`; the with-motion count is asserted in
    // AnswerBurst.test.tsx, which runs without it.
    const { container } = render(<AnswerBurst reaction={{ kind: "yay" }} fireKey={1} />);
    expect(container.querySelectorAll("span.absolute.text-2xl")).toHaveLength(0);
  });
});

describe("under reduced motion: meaning stays", () => {
  it("AnswerBurst still says YAY, so the reaction is not lost", () => {
    render(<AnswerBurst reaction={{ kind: "yay" }} fireKey={1} />);
    expect(screen.getByText("YAY!")).toBeInTheDocument();
  });

  it("AnswerBurst still says how far off a wrong answer was", () => {
    render(<AnswerBurst reaction={{ kind: "miss", tone: "close" }} fireKey={1} />);
    expect(screen.getByText("So close!")).toBeInTheDocument();
  });

  it("the Mastery Meter still reports its reading and its dimming", () => {
    render(<MasteryMeter mastery={60} earned={100} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "60");
    expect(screen.getByText("▼40")).toBeInTheDocument();
  });

  it("the route loader still says what it is waiting for", () => {
    render(<AppLoading label="Finding your mountain…" />);
    expect(screen.getByText("Finding your mountain…")).toBeInTheDocument();
  });
});
