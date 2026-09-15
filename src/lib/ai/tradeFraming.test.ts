import { describe, expect, it, vi } from "vitest";
import { castFor, seedFor } from "./cast";
import { checkFraming, expectedAnswer, requiredNumbers } from "./framingGuard";
import { spokenTrade } from "./spokenProblem";
import type { FramingRequest } from "./types";

const request: FramingRequest = {
  kind: "trade-up",
  theme: "space",
  piles: [
    { unit: 100, count: 2 },
    { unit: 10, count: 14 },
    { unit: 1, count: 1 },
  ],
  target: 341,
};

describe("the trade-up framing kind", () => {
  it("takes the counts as its operands and the value as the answer it must not say", () => {
    expect(requiredNumbers(request)).toEqual([2, 14, 1]);
    expect(expectedAnswer(request)).toBe(341);
    expect(checkFraming(request, "Pip packed 2 boxes of a hundred, 14 bags of ten and 1 loose.", "How many altogether?")).toEqual({ ok: true });
    expect(checkFraming(request, "Pip has 341 rocks in 2 boxes, 14 bags and 1 loose.", "How many?")).toMatchObject({ ok: false });
  });

  it("leaves an empty place out of the story", () => {
    const withEmpty: FramingRequest = { ...request, piles: [{ unit: 100, count: 2 }, { unit: 10, count: 0 }, { unit: 1, count: 14 }], target: 214 };
    expect(requiredNumbers(withEmpty)).toEqual([2, 14]);
  });

  it("seeds its friend from the problem, and not from place-value's seed", () => {
    expect(seedFor(request)).toBe(seedFor(request));
    expect(seedFor(request)).not.toBe(seedFor({ kind: "place-value", theme: "space", target: 341 }));
    expect(seedFor(request)).not.toBe(seedFor({ ...request, piles: [{ unit: 100, count: 3 }, { unit: 10, count: 4 }, { unit: 1, count: 1 }] }));
    expect(castFor(request).name.length).toBeGreaterThan(0);
  });

  it("falls back to a template that tells the counts and asks for the total, never saying it", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const { POST } = await import("@/app/api/coach/route");
    const response = await POST(
      new Request("http://localhost/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ want: "framing", request }),
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      framing: { story: string; question: string; source: string };
    };
    expect(body.framing.source).toBe("template");
    expect(body.framing.story).toContain("2 boxes of a hundred");
    expect(body.framing.story).toContain("14 bags of ten");
    expect(body.framing.story).toContain("1 loose");
    expect(body.framing.story).not.toContain("341");
    expect(body.framing.question).toMatch(/altogether/i);
    expect(body.framing.question).not.toMatch(/\d/);
  });
});

describe("spokenTrade", () => {
  it("reads the story first when there is one, then what the mat asks", () => {
    const task = { units: [100, 10, 1] as const, start: { 1000: 0, 100: 2, 10: 14, 1: 1 } };
    const line = spokenTrade(task, { story: "Pip packed rocks.", question: "?", source: "template" });
    expect(line.startsWith("Pip packed rocks. ")).toBe(true);
    expect(line).toContain("2 hundreds, 14 tens and 1 one");
    expect(line).not.toContain("341");
    expect(line).not.toMatch(/build/i);
  });

  it("stands alone without a story", () => {
    const task = { units: [10, 1] as const, start: { 1000: 0, 100: 0, 10: 0, 1: 18 } };
    expect(spokenTrade(task, null)).toMatch(/^The mat shows 0 tens and 18 ones/);
  });
});
