import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { ClickSparkles } from "./ClickSparkles";

function sparkles(container: HTMLElement): number {
  return container.querySelectorAll("span[style]").length;
}

describe("ClickSparkles", () => {
  it("sits quietly until something is tapped", () => {
    const { container } = render(<ClickSparkles />);
    expect(sparkles(container)).toBe(0);
  });

  it("throws a burst where the child tapped", () => {
    const { container } = render(<ClickSparkles />);
    act(() => {
      fireEvent.pointerDown(window, { clientX: 100, clientY: 150 });
    });
    expect(sparkles(container)).toBeGreaterThan(0);
  });

  it("is decorative and cannot catch a tap of its own", () => {
    const { container } = render(<ClickSparkles />);
    const layer = container.firstElementChild;
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer).toHaveClass("pointer-events-none");
  });

  it("throws a bounded burst, so a child hammering the screen cannot flood it", () => {
    const { container } = render(<ClickSparkles />);
    act(() => { fireEvent.pointerDown(window, { clientX: 10, clientY: 10 }); });
    const perTap = sparkles(container);
    expect(perTap).toBeGreaterThan(0);
    expect(perTap).toBeLessThanOrEqual(12);
  });

  it("removes each sparkle when its animation finishes", async () => {
    // Cleanup is driven by Framer's onAnimationComplete, which runs off
    // requestAnimationFrame rather than a timer — so this waits for real.
    const { container } = render(<ClickSparkles />);
    act(() => { fireEvent.pointerDown(window, { clientX: 10, clientY: 10 }); });
    expect(sparkles(container)).toBeGreaterThan(0);
    await vi.waitFor(() => { expect(sparkles(container)).toBe(0); }, { timeout: 4_000 });
  });

  it("stops listening when it unmounts", () => {
    const { unmount } = render(<ClickSparkles />);
    unmount();
    expect(() => { fireEvent.pointerDown(window, { clientX: 5, clientY: 5 }); }).not.toThrow();
  });
});
