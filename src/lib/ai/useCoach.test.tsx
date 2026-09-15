import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useEncouragement, useSessionSummary, useWordProblem } from "./useCoach";
import { urlOf, jsonBodyOf } from "@test/requests";
import type { FramingRequest } from "./types";

const fetchMock = vi.fn<typeof fetch>();

const JUMP: FramingRequest = {
  kind: "jump",
  theme: "space",
  operation: "add",
  start: 12,
  change: 5,
};

function answers(payload: unknown, status = 200): void {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(payload), { status }));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("useWordProblem", () => {
  it("holds nothing until the words arrive, so the caller shows the bare sum", () => {
    answers({ want: "framing", framing: { story: "s", question: "q", source: "template" } });
    const { result } = renderHook(() => useWordProblem(JUMP));
    expect(result.current).toBeNull();
  });

  it("returns the framing once it lands", async () => {
    answers({ want: "framing", framing: { story: "A story.", question: "A question?", source: "gemini" } });
    const { result } = renderHook(() => useWordProblem(JUMP));
    await waitFor(() => {
      expect(result.current).toEqual({ story: "A story.", question: "A question?", source: "gemini" });
    });
  });

  it("asks the coach endpoint for a framing", async () => {
    answers({ want: "framing", framing: { story: "s", question: "q", source: "template" } });
    renderHook(() => useWordProblem(JUMP));
    await waitFor(() => { expect(fetchMock).toHaveBeenCalledOnce(); });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(urlOf(url as RequestInfo)).toBe("/api/coach");
    expect(jsonBodyOf(init)).toEqual({ want: "framing", request: JUMP });
  });

  it("asks nothing at all when there is no request", () => {
    renderHook(() => useWordProblem(null));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("holds nothing when the endpoint refuses", async () => {
    answers({ error: "no" }, 500);
    const { result } = renderHook(() => useWordProblem(JUMP));
    await waitFor(() => { expect(fetchMock).toHaveBeenCalled(); });
    expect(result.current).toBeNull();
  });

  it("holds nothing when the payload is the wrong shape", async () => {
    answers({ want: "framing", framing: { story: "" } });
    const { result } = renderHook(() => useWordProblem(JUMP));
    await waitFor(() => { expect(fetchMock).toHaveBeenCalled(); });
    expect(result.current).toBeNull();
  });

  it("swallows a network failure rather than showing it mid-climb", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useWordProblem(JUMP));
    await waitFor(() => { expect(fetchMock).toHaveBeenCalled(); });
    expect(result.current).toBeNull();
  });

  it("asks again for a new problem", async () => {
    answers({ want: "framing", framing: { story: "s", question: "q", source: "template" } });
    const { rerender } = renderHook(({ request }: { request: FramingRequest }) => useWordProblem(request), {
      initialProps: { request: JUMP },
    });
    await waitFor(() => { expect(fetchMock).toHaveBeenCalledTimes(1); });
    rerender({ request: { ...JUMP, start: 30 } });
    await waitFor(() => { expect(fetchMock).toHaveBeenCalledTimes(2); });
  });

  it("does not ask again for the same problem", async () => {
    answers({ want: "framing", framing: { story: "s", question: "q", source: "template" } });
    const { rerender } = renderHook(() => useWordProblem(JUMP));
    await waitFor(() => { expect(fetchMock).toHaveBeenCalledTimes(1); });
    rerender();
    rerender();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("useEncouragement", () => {
  it("returns the line once it lands", async () => {
    answers({ want: "encouragement", encouragement: { line: "Lovely.", source: "template" } });
    const { result } = renderHook(() =>
      useEncouragement({ theme: "space", outcome: "correct-first-try" }),
    );
    await waitFor(() => {
      expect(result.current).toEqual({ line: "Lovely.", source: "template" });
    });
  });

  it("asks nothing when there is nothing to react to", () => {
    renderHook(() => useEncouragement(null));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useSessionSummary", () => {
  it("returns the summary line once it lands", async () => {
    answers({ want: "summary", summary: { line: "You got sharper.", source: "template" } });
    const { result } = renderHook(() =>
      useSessionSummary({
        theme: "space",
        skill: "jumps inside a ten",
        shape: "strong",
        masteryRose: true,
        campCompleted: false,
        slips: [],
      }),
    );
    await waitFor(() => {
      expect(result.current).toEqual({ line: "You got sharper.", source: "template" });
    });
  });

  it("asks nothing when there is no sitting to summarise", () => {
    renderHook(() => useSessionSummary(null));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
