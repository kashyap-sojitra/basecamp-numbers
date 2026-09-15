import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRecordSolves } from "./saveMastery";
import { todayLocalDate } from "@/lib/domain/localDate";

const fetchMock = vi.fn<typeof fetch>();

interface Body {
  camp: number;
  clean: boolean;
  localDate: string;
}

/** The parsed body of call `n`, so assertions read like the payload. */
function bodyOf(call: number): Body {
  const init = fetchMock.mock.calls[call]?.[1];
  if (init === undefined || typeof init.body !== "string") throw new Error("no body sent");
  return JSON.parse(init.body) as Body;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ saved: true }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useRecordSolves", () => {
  it("reports nothing when nothing has been solved", () => {
    renderHook(() => { useRecordSolves(1, 0, 0, 0); });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("PATCHes the learner endpoint as JSON", () => {
    renderHook(() => { useRecordSolves(2, 1, 14, 1); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/learner");
    expect(init?.method).toBe("PATCH");
    expect(init?.headers).toEqual({ "content-type": "application/json" });
  });

  it("sends what happened and the child's own day — never the resulting meter", () => {
    renderHook(() => { useRecordSolves(3, 1, 28, 1); });
    // The meter is the server's to work out. Sending it from here is what let
    // one crafted request fill any camp.
    expect(bodyOf(0)).toEqual({
      camp: 3,
      clean: true,
      localDate: todayLocalDate(),
    });
    expect(bodyOf(0)).not.toHaveProperty("mastery");
  });

  it("marks a solve clean only when the clean count rose with it", () => {
    const { rerender } = renderHook(
      ({ solved, clean }: { solved: number; clean: number }) => {
        useRecordSolves(1, solved, solved * 10, clean);
      },
      { initialProps: { solved: 1, clean: 1 } },
    );
    expect(bodyOf(0).clean).toBe(true);
    // Second solve, found after a wobble: the clean count does not move.
    rerender({ solved: 2, clean: 1 });
    expect(bodyOf(1).clean).toBe(false);
    // Third solve, clean again.
    rerender({ solved: 3, clean: 2 });
    expect(bodyOf(2).clean).toBe(true);
  });

  it("reports each solve exactly once", () => {
    const { rerender } = renderHook(
      ({ solved }: { solved: number }) => { useRecordSolves(1, solved, solved * 14, solved); },
      { initialProps: { solved: 1 } },
    );
    for (const solved of [2, 3, 4, 5]) rerender({ solved });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(bodyOf(4).camp).toBe(1);
  });

  it("does not report again when only the meter changes", () => {
    const { rerender } = renderHook(
      ({ mastery }: { mastery: number }) => { useRecordSolves(1, 1, mastery, 1); },
      { initialProps: { mastery: 14 } },
    );
    rerender({ mastery: 28 });
    rerender({ mastery: 100 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps reporting a full meter, since those solves still dim other camps", () => {
    const { rerender } = renderHook(
      ({ solved }: { solved: number }) => { useRecordSolves(4, solved, 100, solved); },
      { initialProps: { solved: 8 } },
    );
    rerender({ solved: 9 });
    rerender({ solved: 10 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(bodyOf(2).camp).toBe(4);
  });

  it("never rethrows a network failure at the child", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(() => renderHook(() => { useRecordSolves(1, 1, 14, 1); })).not.toThrow();
      await vi.waitFor(() => { expect(errors).toHaveBeenCalled(); });
    } finally {
      errors.mockRestore();
    }
  });

  it("logs a rejected save rather than showing it", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 503 }));
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      renderHook(() => { useRecordSolves(1, 1, 14, 1); });
      await vi.waitFor(() => {
        expect(errors).toHaveBeenCalledWith("[progress] solve not recorded:", 503);
      });
    } finally {
      errors.mockRestore();
    }
  });

  it("tries again on the next solve after a failure", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { rerender } = renderHook(
        ({ solved }: { solved: number }) => { useRecordSolves(1, solved, 14, solved); },
        { initialProps: { solved: 1 } },
      );
      await vi.waitFor(() => { expect(errors).toHaveBeenCalled(); });
      rerender({ solved: 2 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      errors.mockRestore();
    }
  });
});
