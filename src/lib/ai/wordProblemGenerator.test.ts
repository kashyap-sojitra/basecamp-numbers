import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EncouragementRequest, FramingRequest, SummaryRequest } from "./types";

/* -------------------------------------------------------------------------- */
/* A fake @google/genai, so no test ever reaches the network.                 */

const generateContent = vi.fn<(args: unknown) => Promise<{ text: string | null }>>();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
  ThinkingLevel: { MINIMAL: "MINIMAL" },
}));

const {
  generateEncouragement,
  generateSessionSummary,
  generateWordProblem,
  resetAiGuardsForTests,
} = await import("./wordProblemGenerator");
const { templateFraming } = await import("./templates");

const JUMP: FramingRequest = {
  kind: "jump",
  theme: "space",
  operation: "add",
  start: 12,
  change: 5,
};

const ENCOURAGE: EncouragementRequest = { theme: "space", outcome: "correct-first-try" };

const SUMMARY: SummaryRequest = {
  theme: "space",
  skill: "jumps across a ten",
  shape: "strong",
  masteryRose: true,
  campCompleted: false,
  slips: [],
};

/** The prompt text out of a recorded generateContent call, whatever its shape. */
function promptOf(args: unknown): string {
  return JSON.stringify(args ?? {});
}

/** A good framing, as the model would return it. */
const GOOD = JSON.stringify({
  story: "Captain Luna counts 12 moon rocks.",
  question: "She finds 5 more. How many now?",
});

/** Each call is a fresh minute, so the rolling budget never interferes. */
function answers(text: string | null): void {
  generateContent.mockResolvedValue({ text });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-11T10:00:00Z"));
  resetAiGuardsForTests();
  generateContent.mockReset();
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

/** Moves past the minimum call gap without leaving the rate window. */
function waitOutTheGap(): void {
  vi.setSystemTime(Date.now() + 1_500);
}

/* -------------------------------------------------------------------------- */

describe("generateWordProblem: with no key", () => {
  it("uses the template bank and never calls out", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(generateWordProblem(JUMP)).resolves.toEqual(templateFraming(JUMP));
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("treats a missing variable the same as an empty one", async () => {
    vi.stubEnv("GEMINI_API_KEY", undefined);
    const framing = await generateWordProblem(JUMP);
    expect(framing.source).toBe("template");
  });
});

describe("generateWordProblem: a good answer", () => {
  it("uses the model's words and labels them as such", async () => {
    answers(GOOD);
    const framing = await generateWordProblem(JUMP);
    expect(framing).toEqual({
      story: "Captain Luna counts 12 moon rocks.",
      question: "She finds 5 more. How many now?",
      source: "gemini",
    });
  });

  it("asks for the least thinking, and for JSON", async () => {
    answers(GOOD);
    await generateWordProblem(JUMP);
    const args = generateContent.mock.calls[0]?.[0] as {
      config: { thinkingConfig: unknown; responseMimeType: string };
    };
    expect(args.config.thinkingConfig).toEqual({ thinkingLevel: "MINIMAL" });
    expect(args.config.responseMimeType).toBe("application/json");
  });

  it("tells the model which numbers it may use", async () => {
    answers(GOOD);
    await generateWordProblem(JUMP);
    const args = generateContent.mock.calls[0]?.[0] as { contents: string };
    expect(args.contents).toContain("12");
    expect(args.contents).toContain("5");
  });

  it("caches a framing, so a repeated problem costs nothing", async () => {
    answers(GOOD);
    await generateWordProblem(JUMP);
    waitOutTheGap();
    await generateWordProblem(JUMP);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});

describe("generateWordProblem: refusing bad answers", () => {
  it("falls back when the model gives the answer away", async () => {
    answers(JSON.stringify({ story: "12 rocks and 5 more makes 17.", question: "How many?" }));
    const framing = await generateWordProblem(JUMP);
    expect(framing.source).toBe("template");
  });

  it("falls back when the model invents a number", async () => {
    answers(JSON.stringify({ story: "12 rocks, 5 stars and 3 comets.", question: "How many?" }));
    expect((await generateWordProblem(JUMP)).source).toBe("template");
  });

  it("falls back when the model drops an operand", async () => {
    answers(JSON.stringify({ story: "Luna counts 12 rocks.", question: "How many now?" }));
    expect((await generateWordProblem(JUMP)).source).toBe("template");
  });

  it("falls back on unparseable JSON", async () => {
    answers("Here is the JSON you asked for: {");
    expect((await generateWordProblem(JUMP)).source).toBe("template");
  });

  it("falls back when the JSON is the wrong shape", async () => {
    answers(JSON.stringify({ tale: "nope" }));
    expect((await generateWordProblem(JUMP)).source).toBe("template");
  });

  it("falls back on an empty response", async () => {
    answers(null);
    expect((await generateWordProblem(JUMP)).source).toBe("template");
  });

  it("falls back when the story is too long for the screen", async () => {
    answers(
      JSON.stringify({
        story: `Luna counts 12 rocks. ${"Space is very big. ".repeat(20)}`,
        question: "She finds 5 more. How many?",
      }),
    );
    expect((await generateWordProblem(JUMP)).source).toBe("template");
  });

  it("falls back when the call throws", async () => {
    generateContent.mockRejectedValue(new Error("network down"));
    expect((await generateWordProblem(JUMP)).source).toBe("template");
  });

  it("never caches a rejected framing", async () => {
    answers(JSON.stringify({ story: "12 and 5 is 17.", question: "How many?" }));
    await generateWordProblem(JUMP);
    waitOutTheGap();
    answers(GOOD);
    expect((await generateWordProblem(JUMP)).source).toBe("gemini");
  });
});

describe("the rate budget", () => {
  it("spaces calls out, serving templates in between", async () => {
    answers(GOOD);
    expect((await generateWordProblem(JUMP)).source).toBe("gemini");
    // Immediately again, inside the minimum gap.
    const second = await generateEncouragement(ENCOURAGE);
    expect(second.source).toBe("template");
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("stops calling once the minute's budget is spent", async () => {
    answers(JSON.stringify({ line: "Lovely work." }));
    for (let i = 0; i < 4; i += 1) {
      waitOutTheGap();
      await generateEncouragement(ENCOURAGE);
    }
    expect(generateContent).toHaveBeenCalledTimes(4);
    // The fifth in the same minute is served locally.
    waitOutTheGap();
    expect((await generateEncouragement(ENCOURAGE)).source).toBe("template");
    expect(generateContent).toHaveBeenCalledTimes(4);
  });

  it("lets the budget roll forward once the window has passed", async () => {
    answers(JSON.stringify({ line: "Lovely work." }));
    for (let i = 0; i < 4; i += 1) {
      waitOutTheGap();
      await generateEncouragement(ENCOURAGE);
    }
    vi.setSystemTime(Date.now() + 61_000);
    expect((await generateEncouragement(ENCOURAGE)).source).toBe("gemini");
  });
});

describe("the breaker", () => {
  it("opens at once on a rate limit, and stays shut for the cooldown", async () => {
    generateContent.mockRejectedValue(new Error("429 Too Many Requests: quota exceeded"));
    expect((await generateEncouragement(ENCOURAGE)).source).toBe("template");
    generateContent.mockClear();
    answers(JSON.stringify({ line: "Lovely work." }));

    waitOutTheGap();
    expect((await generateEncouragement(ENCOURAGE)).source).toBe("template");
    expect(generateContent).not.toHaveBeenCalled();

    // ...and reopens once the cooldown has run out.
    vi.setSystemTime(Date.now() + 61_000);
    expect((await generateEncouragement(ENCOURAGE)).source).toBe("gemini");
  });

  it("takes three ordinary failures before it opens", async () => {
    generateContent.mockRejectedValue(new Error("500 internal"));
    for (let i = 0; i < 3; i += 1) {
      waitOutTheGap();
      await generateEncouragement(ENCOURAGE);
    }
    expect(generateContent).toHaveBeenCalledTimes(3);
    generateContent.mockClear();
    waitOutTheGap();
    await generateEncouragement(ENCOURAGE);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("forgets earlier failures after a success", async () => {
    generateContent.mockRejectedValueOnce(new Error("500 internal"));
    await generateEncouragement(ENCOURAGE);
    answers(JSON.stringify({ line: "Lovely work." }));
    waitOutTheGap();
    await generateEncouragement(ENCOURAGE);
    generateContent.mockRejectedValue(new Error("500 internal"));
    for (let i = 0; i < 2; i += 1) {
      waitOutTheGap();
      await generateEncouragement(ENCOURAGE);
    }
    // Two failures since the success is not yet three, so the breaker is
    // still shut. Step past the rolling window so the budget — a separate
    // guard, with four calls already spent — is not what answers this.
    generateContent.mockClear();
    answers(JSON.stringify({ line: "Lovely work." }));
    vi.setSystemTime(Date.now() + 61_000);
    expect((await generateEncouragement(ENCOURAGE)).source).toBe("gemini");
  });
});

describe("generateEncouragement", () => {
  it("uses the model's line when it is clean", async () => {
    answers(JSON.stringify({ line: "Straight up the mountain!" }));
    await expect(generateEncouragement(ENCOURAGE)).resolves.toEqual({
      line: "Straight up the mountain!",
      source: "gemini",
    });
  });

  it("refuses a line with a number in it, which could contradict the maths", async () => {
    answers(JSON.stringify({ line: "You got all 5 right!" }));
    expect((await generateEncouragement(ENCOURAGE)).source).toBe("template");
  });

  it("refuses markup", async () => {
    answers(JSON.stringify({ line: "**Brilliant**" }));
    expect((await generateEncouragement(ENCOURAGE)).source).toBe("template");
  });

  it("refuses an empty or over-long line", async () => {
    answers(JSON.stringify({ line: "   " }));
    expect((await generateEncouragement(ENCOURAGE)).source).toBe("template");
    waitOutTheGap();
    answers(JSON.stringify({ line: "Lovely. ".repeat(40) }));
    expect((await generateEncouragement(ENCOURAGE)).source).toBe("template");
  });

  it("falls back on unparseable JSON", async () => {
    answers("not json at all");
    expect((await generateEncouragement(ENCOURAGE)).source).toBe("template");
  });

  it("asks the model to echo the local hint", async () => {
    answers(JSON.stringify({ line: "Try lining them up." }));
    await generateEncouragement({ ...ENCOURAGE, outcome: "incorrect", hint: "Rows are uneven." });
    const args = generateContent.mock.calls[0]?.[0] as { contents: string };
    expect(args.contents).toContain("Rows are uneven.");
  });

  it("describes each outcome to the model in its own words", async () => {
    answers(JSON.stringify({ line: "Good." }));
    const prompts: string[] = [];
    for (const outcome of ["correct-first-try", "correct-after-retry", "incorrect"] as const) {
      waitOutTheGap();
      await generateEncouragement({ theme: "ocean", outcome });
      const args = generateContent.mock.calls.at(-1)?.[0] as { contents: string };
      prompts.push(args.contents);
    }
    expect(new Set(prompts).size).toBe(3);
  });
});

describe("generateSessionSummary", () => {
  it("uses the model's line when it is clean", async () => {
    answers(JSON.stringify({ line: "You got sharper at bridging tens." }));
    await expect(generateSessionSummary(SUMMARY)).resolves.toEqual({
      line: "You got sharper at bridging tens.",
      source: "gemini",
    });
  });

  it("refuses a line with a figure, which could contradict the meters", async () => {
    answers(JSON.stringify({ line: "You solved 9 problems!" }));
    expect((await generateSessionSummary(SUMMARY)).source).toBe("template");
  });

  it("tells the model the skill and how the sitting went", async () => {
    answers(JSON.stringify({ line: "Good climbing." }));
    await generateSessionSummary(SUMMARY);
    const args = generateContent.mock.calls[0]?.[0] as { contents: string };
    expect(args.contents).toContain("jumps across a ten");
    expect(args.contents).toContain("quick");
  });

  it("mentions finishing the camp only when it happened", async () => {
    answers(JSON.stringify({ line: "Good climbing." }));
    await generateSessionSummary({ ...SUMMARY, campCompleted: true });
    const withCamp = generateContent.mock.calls[0]?.[0] as { contents: string };
    expect(withCamp.contents).toContain("finished the camp");

    waitOutTheGap();
    await generateSessionSummary({ ...SUMMARY, campCompleted: false, skill: "building arrays" });
    const without = generateContent.mock.calls[1]?.[0] as { contents: string };
    expect(without.contents).not.toContain("finished the camp");
  });

  it("describes every shape of sitting", async () => {
    answers(JSON.stringify({ line: "Good climbing." }));
    const prompts = new Set<string>();
    for (const shape of ["strong", "steady", "wobbly", "nothing"] as const) {
      waitOutTheGap();
      await generateSessionSummary({ ...SUMMARY, shape });
      const args = generateContent.mock.calls.at(-1)?.[0] as { contents: string };
      prompts.add(args.contents);
    }
    expect(prompts.size).toBe(4);
  });

  it("falls back when the call fails", async () => {
    generateContent.mockRejectedValue(new Error("timeout"));
    expect((await generateSessionSummary(SUMMARY)).source).toBe("template");
  });
});

describe("the framing prompt for each kind of problem", () => {
  it("tells the model exactly which numbers an array may use", async () => {
    answers(JSON.stringify({ story: "3 rows of 4 shells.", question: "How many shells?" }));
    const framing = await generateWordProblem({
      kind: "array",
      theme: "ocean",
      rows: 3,
      cols: 4,
    });
    expect(framing.source).toBe("gemini");
    const args = generateContent.mock.calls[0]?.[0] as { contents: string };
    expect(args.contents).toContain("3 rows of 4");
    expect(args.contents).toContain("Use only the numbers 3 and 4");
  });

  it("tells the model exactly which number a place-value task may use", async () => {
    answers(JSON.stringify({ story: "Gather 342 seeds.", question: "Build 342 with blocks." }));
    const framing = await generateWordProblem({
      kind: "place-value",
      theme: "jungle",
      target: 342,
    });
    expect(framing.source).toBe("gemini");
    const args = generateContent.mock.calls[0]?.[0] as { contents: string };
    expect(args.contents).toContain("Use only the number 342");
  });

  it("asks for the right question for a subtraction", async () => {
    answers(JSON.stringify({ story: "12 rocks, and 5 float away.", question: "How many are left?" }));
    await generateWordProblem({ ...JUMP, operation: "subtract" });
    const args = generateContent.mock.calls[0]?.[0] as { contents: string };
    expect(args.contents).toContain("loses");
    expect(args.contents).toContain("left");
  });

  it("gives up on a call that outlasts its deadline", async () => {
    generateContent.mockImplementation(async (args) => {
      const { config } = args as { config: { abortSignal: AbortSignal } };
      // Mimic the SDK: reject as soon as the deadline aborts the request.
      return await new Promise<{ text: string | null }>((_resolve, reject) => {
        config.abortSignal.addEventListener("abort", () => { reject(new Error("aborted")); });
      });
    });
    const pending = generateWordProblem(JUMP);
    await vi.advanceTimersByTimeAsync(7_000);
    expect((await pending).source).toBe("template");
  });
});

describe("the framing cache", () => {
  it("evicts the oldest framing rather than growing without limit", async () => {
    answers(GOOD);
    // Fill past the cache limit; every call needs its own minute of budget.
    for (let index = 0; index < 205; index += 1) {
      vi.setSystemTime(Date.now() + 61_000);
      answers(
        JSON.stringify({
          story: `Luna counts ${String(index)} moon rocks.`,
          question: "She finds 5 more. How many now?",
        }),
      );
      await generateWordProblem({ ...JUMP, start: index, change: 5 });
    }
    // The very first framing has been evicted, so asking again calls out.
    generateContent.mockClear();
    vi.setSystemTime(Date.now() + 61_000);
    answers(JSON.stringify({ story: "Luna counts 0 moon rocks.", question: "She finds 5 more. How many now?" }));
    await generateWordProblem({ ...JUMP, start: 0, change: 5 });
    expect(generateContent).toHaveBeenCalledTimes(1);
  }, 20_000);
});

describe("the summary line is told what the child got better at", () => {
  it("hands the model the slips, in order, so it can see one stop happening", async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({ line: "You stopped counting the start tick." }),
    });
    await generateSessionSummary({
      theme: "space",
      skill: "jumps that bridge a ten",
      shape: "steady",
      masteryRose: true,
      campCompleted: false,
      slips: ["off-by-one", "off-by-one", "did-not-move"],
    });
    const prompt = promptOf(generateContent.mock.calls[0]?.[0]);
    expect(prompt).toContain("off-by-one");
    expect(prompt).toContain("did-not-move");
    // The order is the point: a slip that stopped is what improved.
    expect(prompt.indexOf("off-by-one")).toBeLessThan(prompt.indexOf("did-not-move"));
    expect(prompt.toLowerCase()).toContain("stopped happening");
  });

  it("says so plainly when there were no slips at all", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ line: "Every one first time." }) });
    await generateSessionSummary({
      theme: "ocean",
      skill: "jumps with no carrying",
      shape: "strong",
      masteryRose: true,
      campCompleted: true,
      slips: [],
    });
    expect(promptOf(generateContent.mock.calls[0]?.[0])).toContain("no mistakes at all");
  });

  it("still refuses a line with a number in it, slips or not", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ line: "You fixed 3 mistakes today." }) });
    const result = await generateSessionSummary({
      theme: "jungle",
      skill: "jumps that carry over",
      shape: "steady",
      masteryRose: true,
      campCompleted: false,
      slips: ["missed-the-regroup"],
    });
    // The screen shows the numbers; the line must not contradict them.
    expect(result.source).toBe("template");
  });
});
