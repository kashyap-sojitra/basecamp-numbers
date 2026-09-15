import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { WorldScenery } from "./WorldScenery";
import { THEME_CAST } from "@/lib/ai/cast";
import { INTEREST_PALETTES } from "@/lib/theme/interestTheme";
import type { InterestTheme } from "@/lib/domain/onboarding";

const THEMES: readonly InterestTheme[] = ["space", "ocean", "jungle"];

/** What only that world draws, so a scene can be told from the others. */
const SIGNATURE: Record<InterestTheme, string> = {
  space: "🚀",
  ocean: "🐋",
  jungle: "🦋",
};

describe("WorldScenery", () => {
  it("draws nothing until a world is picked", () => {
    const { container } = render(<WorldScenery theme={null} />);
    expect(container.querySelector("svg")).toHaveAttribute("data-scenery", "none");
    expect(container.querySelectorAll("text, path, circle")).toHaveLength(0);
  });

  it("is decoration, so the whole layer is hidden from a screen reader", () => {
    for (const theme of THEMES) {
      const { container, unmount } = render(<WorldScenery theme={theme} />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("aria-hidden");
      // Every sprite sits inside that one hidden root.
      expect(container.querySelectorAll("text").length).toBeGreaterThan(0);
      expect(container.querySelectorAll(":scope > svg[aria-hidden] text").length).toBe(
        container.querySelectorAll("text").length,
      );
      unmount();
    }
  });

  it("gives each world its own scene, in that world's colours", () => {
    for (const theme of THEMES) {
      const { container, unmount } = render(<WorldScenery theme={theme} />);
      expect(container.textContent).toContain(SIGNATURE[theme]);
      for (const other of THEMES) {
        if (other !== theme) expect(container.textContent).not.toContain(SIGNATURE[other]);
      }
      const { ridge, ridgeFar, piece } = INTEREST_PALETTES[theme];
      expect([ridge, ridgeFar, piece].some((hex) => container.innerHTML.includes(hex))).toBe(true);
      unmount();
    }
  });

  it("puts the story cast on the mountain, so the crew a child meets is the one they saw", () => {
    for (const theme of THEMES) {
      const { container, unmount } = render(<WorldScenery theme={theme} />);
      const glyphs = THEME_CAST[theme].characters.map((c) => c.glyph);
      const onScreen = glyphs.filter((glyph) => container.textContent.includes(glyph));
      expect(onScreen.length).toBeGreaterThanOrEqual(2);
      unmount();
    }
  });

  it("uses no warm colour: nothing has been won yet", () => {
    for (const theme of THEMES) {
      const { container, unmount } = render(<WorldScenery theme={theme} />);
      expect(container.innerHTML.toLowerCase()).not.toMatch(/#ffcb19|#ff800d|#ffeac0|#a94e00/);
      unmount();
    }
  });

  it("is deterministic: two renders of one world are the same picture", () => {
    for (const theme of THEMES) {
      const first = render(<WorldScenery theme={theme} />);
      const a = first.container.innerHTML;
      first.unmount();
      const second = render(<WorldScenery theme={theme} />);
      expect(second.container.innerHTML).toBe(a);
      second.unmount();
    }
  });

  it("moves: sprites start out on their way somewhere", () => {
    const { container } = render(<WorldScenery theme="ocean" />);
    const moving = Array.from(container.querySelectorAll<SVGElement>("g, path, circle, line")).filter(
      (el) => el.style.transform !== "" && el.style.transform !== "none",
    );
    expect(moving.length).toBeGreaterThan(0);
  });
});
