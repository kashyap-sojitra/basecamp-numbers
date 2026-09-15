import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { usePointerParallax } from "./usePointerParallax";
import type { MotionValue } from "framer-motion";

interface Parallax {
  readonly x: MotionValue<number>;
  readonly y: MotionValue<number>;
}

/**
 * Reports the values the hook is tracking. The element's own ref must be the
 * one the hook holds — overriding it with a callback ref would leave the hook
 * looking at nothing, which is the mistake this harness exists to avoid.
 */
function Harness({
  rect,
  onValues,
}: {
  readonly rect: DOMRect | null;
  readonly onValues: (x: number, y: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { x, y } = usePointerParallax(ref);
  onValues(x.get(), y.get());

  useEffect(() => {
    const element = ref.current;
    if (element !== null && rect !== null) {
      element.getBoundingClientRect = () => rect;
    }
  }, [rect]);

  return <div ref={rect === null ? null : ref} data-testid="surface" />;
}

function rectOf(left: number, top: number, width: number, height: number): DOMRect {
  const box: DOMRect = {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
  return box;
}

/** The spring lags on purpose, so the tracked target is read from the source. */
function trackedAfter(rect: DOMRect | null, clientX: number, clientY: number): {
  readonly x: number;
  readonly y: number;
} {
  let latest = { x: 0, y: 0 };
  render(
    <Harness
      rect={rect}
      onValues={(x, y) => {
        latest = { x, y };
      }}
    />,
  );
  window.dispatchEvent(new MouseEvent("mousemove", { clientX, clientY }));
  return latest;
}

/**
 * The value the springs settle on after a pointer move.
 *
 * The lag is the feature — the glow is meant to chase the pointer — so this
 * waits for the spring to arrive rather than reading it synchronously. The
 * motion values are handed out through a callback so nothing is assigned
 * during a render.
 */
async function settledAfter(
  rect: DOMRect,
  clientX: number,
  clientY: number,
): Promise<{ readonly x: number; readonly y: number }> {
  // A holder, not a bare `let`: TypeScript narrows a closure-assigned
  // variable to `never` at the read site.
  const tracked: { current: Parallax | null } = { current: null };

  function Probe() {
    const ref = useRef<HTMLDivElement>(null);
    const parallax = usePointerParallax(ref);
    useEffect(() => {
      const element = ref.current;
      if (element !== null) element.getBoundingClientRect = () => rect;
      tracked.current = parallax;
    }, [parallax]);
    return <div ref={ref} />;
  }

  render(<Probe />);
  window.dispatchEvent(new MouseEvent("mousemove", { clientX, clientY }));

  await vi.waitFor(
    () => {
      const values = tracked.current;
      if (values === null) throw new Error("no parallax yet");
      expect(Math.abs(values.x.get()) + Math.abs(values.y.get())).toBeGreaterThan(0);
    },
    { timeout: 3_000, interval: 20 },
  );

  const values = tracked.current;
  if (values === null) throw new Error("no parallax");
  return { x: values.x.get(), y: values.y.get() };
}

/** Rounded to the nearest whole, since a spring arrives asymptotically. */
function near(value: number): number {
  return Math.round(value * 10) / 10;
}

describe("usePointerParallax", () => {
  it("rests at the centre before the pointer has moved", () => {
    const values = trackedAfter(rectOf(0, 0, 200, 100), 0, 0);
    expect(values.x).toBe(0);
    expect(values.y).toBe(0);
  });

  it("follows the pointer without throwing, wherever it goes", () => {
    const rect = rectOf(100, 100, 200, 100);
    expect(() => {
      trackedAfter(rect, 200, 150);
      trackedAfter(rect, -500, -500);
      trackedAfter(rect, 5000, 5000);
    }).not.toThrow();
  });

  it("moves towards the pointer, clamped so it can never fling past the edge", async () => {
    const rect = rectOf(100, 100, 200, 100);
    const bottomRight = await settledAfter(rect, 9_000, 9_000);
    expect(bottomRight.x).toBeGreaterThan(0);
    expect(bottomRight.x).toBeLessThanOrEqual(1);
    expect(bottomRight.y).toBeGreaterThan(0);
    expect(bottomRight.y).toBeLessThanOrEqual(1);
  });

  it("moves the other way for a pointer off the top left", async () => {
    const topLeft = await settledAfter(rectOf(100, 100, 200, 100), -9_000, -9_000);
    expect(topLeft.x).toBeLessThan(0);
    expect(topLeft.x).toBeGreaterThanOrEqual(-1);
    expect(topLeft.y).toBeLessThan(0);
  });

  it("reads each axis independently", async () => {
    // Pointer at the right edge, vertically centred: x moves, y stays put.
    const rect = rectOf(0, 0, 200, 100);
    const rightMiddle = await settledAfter(rect, 200, 50);
    expect(rightMiddle.x).toBeGreaterThan(0);
    expect(near(rightMiddle.y)).toBe(0);
  });

  it("ignores a pointer move before the element has a size", () => {
    expect(() => trackedAfter(rectOf(0, 0, 0, 0), 50, 50)).not.toThrow();
  });

  it("ignores a pointer move when the element is not mounted", () => {
    expect(() => trackedAfter(null, 50, 50)).not.toThrow();
  });

  it("stops listening when it unmounts", () => {
    const { unmount } = render(<Harness rect={rectOf(0, 0, 200, 100)} onValues={() => undefined} />);
    unmount();
    expect(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 10, clientY: 10 }));
    }).not.toThrow();
  });

  it("returns motion values, so following the pointer costs no re-renders", () => {
    const renders = vi.fn();
    render(<Harness rect={rectOf(0, 0, 200, 100)} onValues={renders} />);
    const before = renders.mock.calls.length;
    for (let i = 0; i < 20; i += 1) {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: i * 5, clientY: i * 2 }));
    }
    // Twenty pointer moves, and React was not asked to render again once.
    expect(renders.mock.calls.length).toBe(before);
  });
});
