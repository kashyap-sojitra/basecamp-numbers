import { describe, expect, it } from "vitest";
import { templateEncouragement, templateFraming, templateSummary } from "./templates";
import { checkFraming } from "./framingGuard";
import { framingSchema, encouragementSchema, summarySchema } from "./types";
import type { AnswerOutcomeKind, FramingRequest, SummaryRequest } from "./types";
import type { InterestTheme } from "@/lib/domain/onboarding";

const THEMES: readonly InterestTheme[] = ["space", "ocean", "jungle"];
const OUTCOMES: readonly AnswerOutcomeKind[] = [
  "correct-first-try",
  "correct-after-retry",
  "incorrect",
];

/** Every kind of framing the app asks for, across themes and operations. */
function everyRequest(): readonly FramingRequest[] {
  const out: FramingRequest[] = [];
  for (const theme of THEMES) {
    for (const operation of ["add", "subtract"] as const) {
      for (const [start, change] of [
        [12, 5],
        [0, 7],
        [100, 20],
        [999, 1],
        [8, 8],
      ] as const) {
        out.push({ kind: "jump", theme, operation, start, change });
      }
    }
    for (const [rows, cols] of [
      [1, 4],
      [3, 4],
      [9, 9],
      [2, 2],
    ] as const) {
      out.push({ kind: "array", theme, rows, cols });
    }
    for (const target of [11, 34, 105, 342, 4821]) {
      out.push({ kind: "place-value", theme, target });
    }
  }
  return out;
}

describe("templateFraming", () => {
  it("passes its own guard for every request the app can make", () => {
    for (const request of everyRequest()) {
      const framing = templateFraming(request);
      const check = checkFraming(request, framing.story, framing.question);
      expect(check, `${JSON.stringify(request)} -> ${framing.story} ${framing.question}`).toEqual({
        ok: true,
      });
    }
  });

  it("produces a framing that satisfies the response schema", () => {
    for (const request of everyRequest()) {
      expect(framingSchema.safeParse(templateFraming(request)).success).toBe(true);
    }
  });

  it("labels itself as coming from the template bank", () => {
    for (const request of everyRequest()) {
      expect(templateFraming(request).source).toBe("template");
    }
  });

  it("gives the same problem the same story, so nothing flickers", () => {
    for (const request of everyRequest()) {
      expect(templateFraming(request)).toEqual(templateFraming(request));
    }
  });

  it("starts every sentence with a capital, even when the actor is 'the monkey'", () => {
    for (const request of everyRequest()) {
      const { story } = templateFraming(request);
      expect(story.charAt(0)).toBe(story.charAt(0).toUpperCase());
    }
  });

  it("varies the story across problems rather than repeating one line", () => {
    const stories = new Set(everyRequest().map((request) => templateFraming(request).story));
    expect(stories.size).toBeGreaterThan(20);
  });

  it("uses the theme's own words", () => {
    const space = templateFraming({ kind: "array", theme: "space", rows: 3, cols: 4 });
    const jungle = templateFraming({ kind: "array", theme: "jungle", rows: 3, cols: 4 });
    expect(space.story).not.toBe(jungle.story);
  });
});

describe("templateEncouragement", () => {
  it("says something kind for every outcome and theme", () => {
    for (const theme of THEMES) {
      for (const outcome of OUTCOMES) {
        const line = templateEncouragement({ theme, outcome });
        expect(encouragementSchema.safeParse(line).success).toBe(true);
        expect(line.source).toBe("template");
      }
    }
  });

  it("never scolds, not even for a wrong answer", () => {
    for (const theme of THEMES) {
      for (const outcome of OUTCOMES) {
        for (let i = 0; i < 30; i += 1) {
          const line = templateEncouragement({ theme, outcome }).line.toLowerCase();
          for (const word of ["wrong", "bad", "fail", "no!", "stupid", "sorry"]) {
            expect(line).not.toContain(word);
          }
        }
      }
    }
  });

  it("ignores the hint, which the Gemini path echoes and the board shows anyway", () => {
    // The specific correction ("Those rows are uneven") is rendered beside the
    // board by the camp itself, so the template line stays generic rather than
    // repeating it. Only the Gemini prompt asks for the nudge to be echoed.
    const withHint = templateEncouragement({
      theme: "space",
      outcome: "incorrect",
      hint: "Those rows are uneven.",
    });
    expect(encouragementSchema.safeParse(withHint).success).toBe(true);
    expect(withHint.line).not.toContain("Those rows are uneven.");
  });

  it("stays inside the length the schema allows, whatever hint it is handed", () => {
    const line = templateEncouragement({
      theme: "ocean",
      outcome: "incorrect",
      hint: "A".repeat(200),
    });
    expect(encouragementSchema.safeParse(line).success).toBe(true);
    expect(line.line.length).toBeLessThanOrEqual(140);
  });
});

describe("templateSummary", () => {
  function everySummary(): readonly SummaryRequest[] {
    const out: SummaryRequest[] = [];
    for (const theme of THEMES) {
      for (const shape of ["strong", "steady", "wobbly", "nothing"] as const) {
        for (const masteryRose of [true, false]) {
          for (const campCompleted of [true, false]) {
            out.push({ theme, skill: "jumps across a ten", shape, masteryRose, campCompleted, slips: [] });
          }
        }
      }
    }
    return out;
  }

  it("writes a line for every shape of sitting", () => {
    for (const request of everySummary()) {
      const summary = templateSummary(request);
      expect(summarySchema.safeParse(summary).success).toBe(true);
      expect(summary.source).toBe("template");
    }
  });

  it("mentions no numbers, because the screen already shows them", () => {
    for (const request of everySummary()) {
      expect(templateSummary(request).line).not.toMatch(/\d/);
    }
  });

  it("names the skill that was practised", () => {
    for (const shape of ["strong", "steady", "wobbly"] as const) {
      const summary = templateSummary({
        theme: "space",
        skill: "jumps across a ten",
        shape,
        masteryRose: true,
        campCompleted: false,
        slips: [],
      });
      // The skill can open the sentence, in which case it is capitalised.
      expect(summary.line.toLowerCase()).toContain("jumps across a ten");
    }
  });

  it("says nothing about a skill when nothing was climbed", () => {
    const summary = templateSummary({
      theme: "space",
      skill: "jumps across a ten",
      shape: "nothing",
      masteryRose: false,
      campCompleted: false,
      slips: [],
    });
    expect(summary.line.toLowerCase()).not.toContain("jumps across a ten");
  });

  it("says so when the camp was finished", () => {
    const finished = templateSummary({
      theme: "space",
      skill: "building arrays",
      shape: "strong",
      masteryRose: true,
      campCompleted: true,
      slips: [],
    });
    expect(finished.line.toLowerCase()).toContain("camp");
  });
});
