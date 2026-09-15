import { describe, expect, it } from "vitest";
import {
  GRADE_BAND_OPTIONS,
  INTEREST_THEME_OPTIONS,
  climberProfileSchema,
  gradeBandSchema,
  interestThemeSchema,
} from "./onboarding";

describe("onboarding schemas", () => {
  it("accepts the three grade bands and nothing else", () => {
    for (const band of ["k-1", "2-3", "4-5"]) {
      expect(gradeBandSchema.parse(band)).toBe(band);
    }
    for (const bad of ["K-1", "6-7", "", null]) {
      expect(gradeBandSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("accepts the three interest themes and nothing else", () => {
    for (const theme of ["space", "ocean", "jungle"]) {
      expect(interestThemeSchema.parse(theme)).toBe(theme);
    }
    for (const bad of ["desert", "Space", 1]) {
      expect(interestThemeSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("requires both picks to make a profile", () => {
    expect(climberProfileSchema.safeParse({ gradeBand: "k-1" }).success).toBe(false);
    expect(climberProfileSchema.safeParse({ interestTheme: "ocean" }).success).toBe(false);
    expect(
      climberProfileSchema.parse({ gradeBand: "k-1", interestTheme: "ocean" }),
    ).toEqual({ gradeBand: "k-1", interestTheme: "ocean" });
  });
});

describe("the options offered at onboarding", () => {
  it("offers every grade band the schema accepts, once each", () => {
    const values = GRADE_BAND_OPTIONS.map((option) => option.value);
    expect(new Set(values)).toEqual(new Set(["k-1", "2-3", "4-5"]));
    expect(values).toHaveLength(3);
  });

  it("offers every interest theme the schema accepts, once each", () => {
    const values = INTEREST_THEME_OPTIONS.map((option) => option.value);
    expect(new Set(values)).toEqual(new Set(["space", "ocean", "jungle"]));
    expect(values).toHaveLength(3);
  });

  it("gives every option a label, a blurb and (for themes) a glyph", () => {
    for (const option of GRADE_BAND_OPTIONS) {
      expect(option.stage.length).toBeGreaterThan(0);
      expect(option.ages.length).toBeGreaterThan(0);
      expect(option.grade.length).toBeGreaterThan(0);
      expect(option.blurb.length).toBeGreaterThan(0);
      expect(option.glyph.length).toBeGreaterThan(0);
    }
    for (const option of INTEREST_THEME_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.blurb.length).toBeGreaterThan(0);
      expect(option.glyph.length).toBeGreaterThan(0);
    }
  });
});
