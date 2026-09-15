import { describe, expect, it } from "vitest";
import { BAND_RANGES, jumpSkillDescription, jumpSkillPhrase } from "./numberLine";
import type { GradeBand } from "@/lib/domain/onboarding";

const BANDS: readonly GradeBand[] = ["k-1", "2-3", "4-5"];

describe("BAND_RANGES", () => {
  it("covers every band", () => {
    for (const band of BANDS) expect(BAND_RANGES[band]).toBeDefined();
  });

  it("raises the ceiling as the band goes up", () => {
    expect(BAND_RANGES["k-1"].ceiling).toBeLessThan(BAND_RANGES["2-3"].ceiling);
    expect(BAND_RANGES["2-3"].ceiling).toBeLessThan(BAND_RANGES["4-5"].ceiling);
  });

  it("keeps every jump bound sane and inside the ceiling", () => {
    for (const band of BANDS) {
      const range = BAND_RANGES[band];
      expect(range.minChange).toBeGreaterThan(0);
      expect(range.minChange).toBeLessThanOrEqual(range.maxChange);
      expect(range.maxChange).toBeLessThan(range.ceiling);
      expect([10, 100]).toContain(range.unit);
    }
  });

  it("fixes the line only for K-1, where the same line every time is the point", () => {
    expect(BAND_RANGES["k-1"].fixedLine).toEqual({ min: 0, max: 20 });
    expect(BAND_RANGES["2-3"].fixedLine).toBeNull();
    expect(BAND_RANGES["4-5"].fixedLine).toBeNull();
  });
});

describe("skill wording", () => {
  it("names the band's own ceiling, and the two skills differently", () => {
    for (const band of BANDS) {
      expect(jumpSkillDescription("within-place", band)).toContain(
        String(BAND_RANGES[band].ceiling),
      );
      expect(jumpSkillDescription("within-place", band)).not.toBe(
        jumpSkillDescription("cross-place", band),
      );
    }
  });

  it("keeps the ten in K-1's words, where the child really does stay inside one", () => {
    expect(jumpSkillPhrase("within-place", "k-1")).toBe("jumps inside a ten");
    expect(jumpSkillPhrase("cross-place", "k-1")).toBe("jumps that bridge a ten");
  });

  it("does not claim the older bands stay inside a ten, because they do not", () => {
    // 29 - 17 needs no carrying and still travels across two tens.
    for (const band of ["2-3", "4-5"] as const) {
      expect(jumpSkillPhrase("within-place", band)).not.toContain("inside");
      expect(jumpSkillPhrase("within-place", band)).toBe("jumps with no carrying");
      expect(jumpSkillPhrase("cross-place", band)).toBe("jumps that carry over");
    }
  });

  it("gives a phrase that reads inside a sentence", () => {
    const sentence = `You are getting quicker at ${jumpSkillPhrase("cross-place", "2-3")}.`;
    expect(sentence).toBe("You are getting quicker at jumps that carry over.");
  });
});
