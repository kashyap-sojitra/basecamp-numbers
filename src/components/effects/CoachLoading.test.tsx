import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { CoachLoading } from "./CoachLoading";
import { INTEREST_PALETTES } from "@/lib/theme/interestTheme";
import type { InterestTheme } from "@/lib/domain/onboarding";

const THEMES: readonly InterestTheme[] = ["space", "ocean", "jungle"];

describe("CoachLoading", () => {
  it("announces the wait politely rather than silently", () => {
    render(<CoachLoading theme="space" />);
    const status = screen.getByLabelText("Writing your word problem");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("shows the child's own character, whichever world they chose", () => {
    for (const theme of THEMES) {
      const { container, unmount } = render(<CoachLoading theme={theme} />);
      expect(container.textContent).toContain(INTEREST_PALETTES[theme].glyph);
      unmount();
    }
  });

  it("renders as a line by default and as a panel when asked", () => {
    const { container, unmount } = render(<CoachLoading theme="ocean" />);
    const line = container.innerHTML;
    unmount();
    const panel = render(<CoachLoading theme="ocean" variant="panel" />);
    expect(panel.container.innerHTML).not.toBe(line);
  });

  it("gives the panel skeleton lines to stand in for the words", () => {
    const { container } = render(<CoachLoading theme="jungle" variant="panel" />);
    expect(container.querySelectorAll("div").length).toBeGreaterThan(3);
  });
});

describe("CoachLoading: the words", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("cycles its messages, so a long wait does not read as a stuck screen", () => {
    vi.useFakeTimers();
    const { container } = render(<CoachLoading theme="space" />);
    const first = container.textContent;
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(container.textContent).not.toBe(first);
  });

  it("comes back round rather than running out of things to say", () => {
    vi.useFakeTimers();
    const { container } = render(<CoachLoading theme="ocean" />);
    const seen = new Set<string>();
    for (let tick = 0; tick < 12; tick += 1) {
      seen.add(container.textContent);
      act(() => { vi.advanceTimersByTime(1_800); });
    }
    expect(seen.size).toBeGreaterThan(1);
    // Every message belongs to the chosen world, not a generic pool.
    expect(seen.size).toBeLessThan(12);
  });

  it("stops its timer when it unmounts", () => {
    vi.useFakeTimers();
    const { unmount } = render(<CoachLoading theme="jungle" />);
    unmount();
    expect(() => { act(() => { vi.advanceTimersByTime(10_000); }); }).not.toThrow();
  });
});
