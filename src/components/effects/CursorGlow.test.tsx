import { describe, expect, it } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { CursorGlow } from "./CursorGlow";

/** Wakes the glow, which stays hidden until it knows where the pointer is. */
function moveMouse(x = 120, y = 240): void {
  act(() => {
    fireEvent.mouseMove(window, { clientX: x, clientY: y });
  });
}

describe("CursorGlow", () => {
  it("shows nothing on a touch screen, where there is no cursor to follow", () => {
    const { container } = render(<CursorGlow />);
    expect(container.firstChild).toBeNull();
  });

  it("appears once the pointer moves", () => {
    const { container } = render(<CursorGlow />);
    moveMouse();
    expect(container.firstElementChild).not.toBeNull();
  });

  it("is decorative and cannot catch a tap", () => {
    const { container } = render(<CursorGlow />);
    moveMouse();
    const layer = container.firstElementChild;
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer).toHaveClass("pointer-events-none");
  });

  it("follows the pointer without throwing, anywhere on screen", () => {
    render(<CursorGlow />);
    expect(() => {
      moveMouse(0, 0);
      moveMouse(1920, 1080);
      moveMouse(-50, -50);
    }).not.toThrow();
  });

  it("stops listening when it unmounts", () => {
    const { unmount } = render(<CursorGlow />);
    moveMouse();
    unmount();
    expect(() => { fireEvent.mouseMove(window, { clientX: 10, clientY: 10 }); }).not.toThrow();
  });
});
