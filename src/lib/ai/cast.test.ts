import { describe, expect, it } from "vitest";
import { castFor, THEME_CAST } from "./cast";
import { INTEREST_THEME_OPTIONS } from "@/lib/domain/onboarding";
import type { FramingRequest } from "./types";

describe("the recurring cast", () => {
  it("gives every theme a cast, so no child meets an anonymous 'someone'", () => {
    for (const { value } of INTEREST_THEME_OPTIONS) {
      expect(THEME_CAST[value].characters.length).toBeGreaterThan(1);
    }
  });

  it("never puts a digit in a name, which the framing guard would read as an invented number", () => {
    for (const { value } of INTEREST_THEME_OPTIONS) {
      for (const character of THEME_CAST[value].characters) {
        expect(character.name).not.toMatch(/\d/);
        expect(character.note).not.toMatch(/\d/);
      }
    }
  });

  it("gives the same problem the same friend every time, so nothing flickers", () => {
    const request: FramingRequest = { kind: "jump", theme: "space", operation: "add", start: 5, change: 2 };
    const first = castFor(request);
    for (let i = 0; i < 50; i += 1) expect(castFor(request)).toEqual(first);
  });

  it("spreads the cast across problems rather than favouring one", () => {
    const names = new Set<string>();
    for (let start = 1; start <= 20; start += 1) {
      names.add(castFor({ kind: "jump", theme: "jungle", operation: "add", start, change: 3 }).name);
    }
    expect(names.size).toBeGreaterThan(1);
  });

  it("keeps each theme's cast to its own world", () => {
    const space = THEME_CAST.space.characters.map((c) => c.name);
    const jungle = THEME_CAST.jungle.characters.map((c) => c.name);
    expect(space.filter((n) => jungle.includes(n))).toEqual([]);
  });
});
