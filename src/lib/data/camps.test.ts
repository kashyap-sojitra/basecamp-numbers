import { describe, expect, it } from "vitest";
import { CAMP_DEFINITIONS } from "./camps";
import { CAMP_NUMBERS } from "@/lib/domain/camp";

describe("CAMP_DEFINITIONS", () => {
  it("defines exactly four camps, numbered 1 to 4 in order", () => {
    expect(CAMP_DEFINITIONS).toHaveLength(4);
    expect(CAMP_DEFINITIONS.map((camp) => camp.number)).toEqual([...CAMP_NUMBERS]);
  });

  it("uses only mechanics the app actually implements", () => {
    for (const camp of CAMP_DEFINITIONS) {
      expect(["number-line-jump", "pick-the-jump", "array-grouping", "trade-up"]).toContain(
        camp.mechanic.kind,
      );
    }
  });

  it("gives every camp a different thing to do, so no two camps play the same", () => {
    const signatures = CAMP_DEFINITIONS.map((camp) => {
      switch (camp.mechanic.kind) {
        case "number-line-jump":
          return `jump:${camp.mechanic.skill}`;
        case "pick-the-jump":
          return `pick:${camp.mechanic.skill}`;
        case "array-grouping":
          return `group:${camp.mechanic.focus}`;
        case "trade-up":
          return "trade";
      }
    });
    expect(new Set(signatures).size).toBe(4);
  });

  it("gives each camp its own act, in the order the skills build", () => {
    expect(CAMP_DEFINITIONS[0].mechanic.kind).toBe("number-line-jump");
    // Camp 2 keeps the crossing jump but answers it by choosing, not walking.
    expect(CAMP_DEFINITIONS[1].mechanic.kind).toBe("pick-the-jump");
    expect(CAMP_DEFINITIONS[2].mechanic.kind).toBe("array-grouping");
    // The summit trades rather than builds — see `TradeTask`.
    expect(CAMP_DEFINITIONS[3].mechanic.kind).toBe("trade-up");
  });

  it("gives every camp a name, a skill line and a distinct marker on the map", () => {
    const seen = new Set<string>();
    for (const camp of CAMP_DEFINITIONS) {
      expect(camp.name.length).toBeGreaterThan(0);
      expect(camp.skill.length).toBeGreaterThan(0);
      expect(camp.marker.xPercent).toBeGreaterThanOrEqual(0);
      expect(camp.marker.xPercent).toBeLessThanOrEqual(100);
      expect(camp.marker.yPercent).toBeGreaterThanOrEqual(0);
      expect(camp.marker.yPercent).toBeLessThanOrEqual(100);
      seen.add(`${String(camp.marker.xPercent)},${String(camp.marker.yPercent)}`);
    }
    expect(seen.size).toBe(4);
  });

  it("climbs up and to the right, so the path reads as a mountain", () => {
    for (let i = 1; i < CAMP_DEFINITIONS.length; i += 1) {
      const below = CAMP_DEFINITIONS[i - 1];
      const above = CAMP_DEFINITIONS[i];
      if (below === undefined || above === undefined) throw new Error("bad definitions");
      expect(above.marker.xPercent).toBeGreaterThan(below.marker.xPercent);
      expect(above.marker.yPercent).toBeLessThan(below.marker.yPercent);
    }
  });
});
