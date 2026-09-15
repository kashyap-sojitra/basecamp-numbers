import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MountainBackdrop } from "./MountainBackdrop";
import { INTEREST_PALETTES } from "@/lib/theme/interestTheme";
import type { InterestTheme } from "@/lib/domain/onboarding";

const THEMES: readonly InterestTheme[] = ["space", "ocean", "jungle"];

describe("MountainBackdrop", () => {
  it("is decoration, so it says nothing to a screen reader", () => {
    const { container } = render(<MountainBackdrop palette={INTEREST_PALETTES.space} />);
    expect(container.textContent).toBe("");
  });

  it("paints in the chosen world's colours", () => {
    for (const theme of THEMES) {
      const palette = INTEREST_PALETTES[theme];
      const { container, unmount } = render(<MountainBackdrop palette={palette} />);
      expect(container.innerHTML).toContain(palette.ridge);
      unmount();
    }
  });

  it("goes on past the summit only when asked to", () => {
    const plain = render(<MountainBackdrop palette={INTEREST_PALETTES.space} />);
    expect(plain.container.querySelector("svg")).toHaveAttribute("viewBox", "0 0 1000 625");
    plain.unmount();
    const wide = render(<MountainBackdrop palette={INTEREST_PALETTES.space} extended />);
    expect(wide.container.querySelector("svg")).toHaveAttribute("viewBox", "0 0 1520 625");
    // The next range's peaks, where the coming-soon camps stand.
    expect(wide.container.innerHTML).toContain("1130 345");
    expect(wide.container.innerHTML).toContain("1343 175");
  });

  it("renders without a pointer ever having moved", () => {
    expect(() => render(<MountainBackdrop palette={INTEREST_PALETTES.jungle} />)).not.toThrow();
  });
});
