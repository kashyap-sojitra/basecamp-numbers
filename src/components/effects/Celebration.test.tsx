import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { Celebration } from "./Celebration";

/** Counts the confetti pieces, which are the only styled spans in there. */
function pieces(container: HTMLElement): number {
  return container.querySelectorAll("span[style]").length;
}

describe("Celebration", () => {
  it("shows nothing until something is worth celebrating", () => {
    const { container } = render(<Celebration variant="burst" fireKey={0} />);
    expect(pieces(container)).toBe(0);
  });

  it("throws confetti for a burst", () => {
    const { container } = render(<Celebration variant="burst" fireKey={1} />);
    expect(pieces(container)).toBeGreaterThan(10);
  });

  it("rains more widely for finishing a camp than for one answer", () => {
    const burst = render(<Celebration variant="burst" fireKey={1} />);
    const burstCount = pieces(burst.container);
    burst.unmount();
    const rain = render(<Celebration variant="rain" fireKey={1} />);
    expect(pieces(rain.container)).toBeGreaterThan(burstCount);
  });

  it("is decorative and cannot catch a tap", () => {
    const { container } = render(<Celebration variant="burst" fireKey={1} />);
    const layer = container.firstElementChild;
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer).toHaveClass("pointer-events-none");
  });

  it("covers the whole screen for rain and only its container for a burst", () => {
    const rain = render(<Celebration variant="rain" fireKey={1} />);
    expect(rain.container.firstElementChild).toHaveClass("fixed");
    rain.unmount();
    const burst = render(<Celebration variant="burst" fireKey={1} />);
    expect(burst.container.firstElementChild).toHaveClass("absolute");
  });

  it("is a pure function of its fire key", () => {
    const first = render(<Celebration variant="burst" fireKey={4} />);
    const html = first.container.innerHTML;
    first.unmount();
    const second = render(<Celebration variant="burst" fireKey={4} />);
    expect(second.container.innerHTML).toBe(html);
  });

  it("tidies the pieces away once they have fallen", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<Celebration variant="burst" fireKey={1} />);
      expect(pieces(container)).toBeGreaterThan(0);
      act(() => { vi.advanceTimersByTime(3_000); });
      expect(pieces(container)).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fires again for a new celebration after clearing", () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = render(<Celebration variant="burst" fireKey={1} />);
      act(() => { vi.advanceTimersByTime(3_000); });
      expect(pieces(container)).toBe(0);
      rerender(<Celebration variant="burst" fireKey={2} />);
      expect(pieces(container)).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
