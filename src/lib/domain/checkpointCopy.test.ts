import { describe, expect, it } from "vitest";
import { checkpointCopy } from "./checkpointCopy";
import { GRADE_BAND_OPTIONS } from "./onboarding";

/** Every string a band can be shown, so a sweep can read all of them. */
function everyLine(band: "k-1" | "2-3" | "4-5"): string {
  const c = checkpointCopy(band);
  return [
    c.chip, c.eyebrow, c.action, c.reviewEyebrow, c.reviewSubtitle,
    c.headline(1), c.card(1), c.gate(1), c.foot(1), c.done(1), c.detail(100, 68, 14),
  ].join(" ");
}

describe("checkpointCopy: the youngest band gets concrete words", () => {
  /** The abstractions a five-year-old has to translate before they can act. */
  const ABSTRACT = ["dim", "checkpoint", "meter", "review", "slipped"];

  it("never uses an abstract word on a K-1 child", () => {
    const text = everyLine("k-1").toLowerCase();
    for (const word of ABSTRACT) expect(text).not.toContain(word);
  });

  it("tells a K-1 child what to do instead, in one physical word", () => {
    expect(everyLine("k-1").toLowerCase()).toContain("warm-up");
  });

  it("gives K-1 one number to hold, not three", () => {
    const digits = [...checkpointCopy("k-1").detail(100, 68, 14).matchAll(/\d+/g)];
    expect(digits).toHaveLength(1);
    // The older bands are told exactly what slipped and by how much.
    expect([...checkpointCopy("2-3").detail(100, 68, 14).matchAll(/\d+/g)].length).toBeGreaterThan(1);
  });

  it("keeps the dimming language for the bands who can carry it", () => {
    for (const band of ["2-3", "4-5"] as const) {
      expect(everyLine(band).toLowerCase()).toContain("dim");
    }
  });

  it("never leaves a band without words", () => {
    for (const { value } of GRADE_BAND_OPTIONS) {
      const c = checkpointCopy(value);
      for (const line of [c.chip, c.eyebrow, c.action, c.headline(1), c.card(1), c.gate(1), c.foot(1)]) {
        expect(line.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("is encouraging in every band — nothing says lost, failed or broken", () => {
    for (const { value } of GRADE_BAND_OPTIONS) {
      const text = everyLine(value).toLowerCase();
      for (const word of ["lost", "failed", "missed", "broken", "wrong"]) {
        expect(text).not.toContain(word);
      }
    }
  });
});
