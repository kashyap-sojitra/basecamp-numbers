import { describe, expect, it } from "vitest";
import { CELEBRATION_COLORS, SPARKLE_COLORS, SPRING, pick } from "./presets";

describe("SPRING", () => {
  it("offers the three motions the app uses, all real springs", () => {
    for (const preset of [SPRING.settle, SPRING.snap, SPRING.bounce]) {
      expect(preset.type).toBe("spring");
      expect(preset.stiffness).toBeGreaterThan(0);
      expect(preset.damping).toBeGreaterThan(0);
    }
  });

  it("makes snap snappier than settle, and bounce bouncier than both", () => {
    expect(SPRING.snap.stiffness).toBeGreaterThan(SPRING.settle.stiffness);
    expect(SPRING.bounce.damping).toBeLessThan(SPRING.settle.damping);
    expect(SPRING.bounce.damping).toBeLessThan(SPRING.snap.damping);
  });

  it("keeps every spring under-damped enough to feel alive, but not to wobble", () => {
    for (const preset of [SPRING.settle, SPRING.snap, SPRING.bounce]) {
      // damping ratio = c / (2 * sqrt(k * m)), m = 1
      const ratio = preset.damping / (2 * Math.sqrt(preset.stiffness));
      expect(ratio).toBeGreaterThan(0.35);
      expect(ratio).toBeLessThan(1.1);
    }
  });
});

describe("the particle palettes", () => {
  it("reference theme tokens rather than raw hex, so the theme stays one place", () => {
    for (const colour of [...SPARKLE_COLORS, ...CELEBRATION_COLORS]) {
      expect(colour).toMatch(/^var\(--[a-z-]+\)$/);
    }
  });

  it("keeps warm hues out of the everyday sparkle palette", () => {
    // Warm colours are reserved for reward moments, per CLAUDE.md.
    for (const colour of SPARKLE_COLORS) {
      expect(colour).not.toContain("reward");
    }
  });

  it("lets celebration use the warm palette, since a win is what it is for", () => {
    expect(CELEBRATION_COLORS.some((colour) => colour.includes("reward"))).toBe(true);
  });

  it("offers enough colours for a burst to look varied", () => {
    expect(SPARKLE_COLORS.length).toBeGreaterThanOrEqual(4);
    expect(CELEBRATION_COLORS.length).toBeGreaterThanOrEqual(4);
  });
});

describe("pick", () => {
  it("always returns a member of the list", () => {
    const items = ["a", "b", "c"] as const;
    for (let i = 0; i < 500; i += 1) {
      expect(items).toContain(pick(items));
    }
  });

  it("reaches every entry", () => {
    const items = ["a", "b", "c"] as const;
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) seen.add(pick(items));
    expect(seen).toEqual(new Set(items));
  });

  it("returns the only entry from a single-item list", () => {
    expect(pick(["only"] as const)).toBe("only");
  });
});
