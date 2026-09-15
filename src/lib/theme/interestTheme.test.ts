import { describe, expect, it } from "vitest";
import { INTEREST_PALETTES } from "./interestTheme";
import { interestThemeSchema, type InterestTheme } from "@/lib/domain/onboarding";

const THEMES: readonly InterestTheme[] = ["space", "ocean", "jungle"];

/** Relative luminance, per WCAG. */
function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (light + 0.05) / (dark + 0.05);
}

const WHITE = "#ffffff";

describe("INTEREST_PALETTES", () => {
  it("covers every theme the schema accepts", () => {
    for (const theme of THEMES) {
      expect(interestThemeSchema.safeParse(theme).success).toBe(true);
      expect(INTEREST_PALETTES[theme]).toBeDefined();
    }
    expect(Object.keys(INTEREST_PALETTES)).toHaveLength(3);
  });

  it("defines every colour as a six-digit hex, so contrast can be checked", () => {
    for (const theme of THEMES) {
      const palette = INTEREST_PALETTES[theme];
      for (const colour of [
        palette.sky,
        palette.ridgeFar,
        palette.ridge,
        palette.trail,
        palette.piece,
        palette.pieceInk,
        palette.line,
      ]) {
        expect(colour).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("gives every theme a label and a glyph", () => {
    for (const theme of THEMES) {
      expect(INTEREST_PALETTES[theme].label.length).toBeGreaterThan(0);
      expect(INTEREST_PALETTES[theme].glyph.length).toBeGreaterThan(0);
    }
  });

  it("clears WCAG AA 3:1 for a game piece against its white board", () => {
    // A non-text boundary that carries meaning: the child has to see the tile.
    for (const theme of THEMES) {
      expect(contrast(INTEREST_PALETTES[theme].piece, WHITE)).toBeGreaterThanOrEqual(3);
    }
  });

  it("clears WCAG AA 4.5:1 for text printed on a game piece", () => {
    for (const theme of THEMES) {
      const palette = INTEREST_PALETTES[theme];
      expect(contrast(palette.piece, palette.pieceInk)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("clears 3:1 for a board rule against white", () => {
    for (const theme of THEMES) {
      expect(contrast(INTEREST_PALETTES[theme].line, WHITE)).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the trail visible against the mountain face it crosses", () => {
    for (const theme of THEMES) {
      const palette = INTEREST_PALETTES[theme];
      expect(contrast(palette.trail, palette.ridge)).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the sky pale, so the light frame stays light", () => {
    for (const theme of THEMES) {
      expect(luminance(INTEREST_PALETTES[theme].sky)).toBeGreaterThan(0.7);
    }
  });

  it("hazes the distant range back behind the near one", () => {
    for (const theme of THEMES) {
      const palette = INTEREST_PALETTES[theme];
      expect(luminance(palette.ridgeFar)).toBeGreaterThan(luminance(palette.ridge));
    }
  });

  it("gives each theme its own colours, so the three worlds look different", () => {
    // Only one theme is ever on screen, so these are compared for identity
    // rather than contrast — violet and blue can share a luminance quite
    // happily while still reading as different worlds.
    const pieces = THEMES.map((theme) => INTEREST_PALETTES[theme].piece);
    const skies = THEMES.map((theme) => INTEREST_PALETTES[theme].sky);
    const ridges = THEMES.map((theme) => INTEREST_PALETTES[theme].ridge);
    expect(new Set(pieces).size).toBe(THEMES.length);
    expect(new Set(skies).size).toBe(THEMES.length);
    expect(new Set(ridges).size).toBe(THEMES.length);
  });
});
