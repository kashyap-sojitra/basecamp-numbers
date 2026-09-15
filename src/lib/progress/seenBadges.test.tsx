import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  UNKNOWN_SEEN,
  forgetSeenBadgesSnapshot,
  parseSeenBadges,
  readSeenBadges,
  useFreshBadges,
  writeSeenBadges,
} from "./seenBadges";
import type { BadgeId } from "@/lib/domain/badges";

const KEY = "bn_seen_badges";

afterEach(() => {
  window.localStorage.clear();
  // Each test is a fresh visit, and the snapshot is cached per page load.
  forgetSeenBadgesSnapshot();
});

describe("readSeenBadges", () => {
  it("reads an empty list when nothing has been stored", () => {
    expect(readSeenBadges()).toBe("[]");
  });

  it("reads back what was written, on the next visit", () => {
    writeSeenBadges(JSON.stringify(["first-climb"]));
    forgetSeenBadgesSnapshot();
    expect(readSeenBadges()).toBe('["first-climb"]');
  });

  it("does not change for this visit once something is written", () => {
    const before = readSeenBadges();
    writeSeenBadges(JSON.stringify(["first-climb"]));
    expect(readSeenBadges()).toBe(before);
  });

  it("reads an empty list rather than throwing when storage is blocked", () => {
    const spy = vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked in a private window");
    });
    try {
      expect(readSeenBadges()).toBe("[]");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("writeSeenBadges", () => {
  it("stores the list", () => {
    writeSeenBadges(JSON.stringify(["summit"]));
    expect(window.localStorage.getItem(KEY)).toBe('["summit"]');
  });

  it("swallows a storage failure, since the cost is one spotlight", () => {
    const spy = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    try {
      expect(() => { writeSeenBadges("[]"); }).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("parseSeenBadges", () => {
  it("returns null for the server snapshot, meaning nothing is known yet", () => {
    expect(parseSeenBadges(UNKNOWN_SEEN)).toBeNull();
  });

  it("parses a stored list into a set", () => {
    expect(parseSeenBadges('["a","b"]')).toEqual(new Set(["a", "b"]));
  });

  it("reads an empty set from an empty list", () => {
    expect(parseSeenBadges("[]")).toEqual(new Set());
  });

  it("reads an empty set from corrupted or hand-edited storage", () => {
    for (const junk of ["not json", "{", '{"a":1}', "42", '["a",2]', "null"]) {
      expect(parseSeenBadges(junk)).toEqual(new Set());
    }
  });
});

describe("useFreshBadges", () => {
  const earned: readonly BadgeId[] = ["first-climb", "camp-mastered"];

  it("treats every earned badge as new on a first ever visit", () => {
    const { result } = renderHook(() => useFreshBadges(earned));
    expect(result.current).toEqual(earned);
  });

  it("records what it showed, so the next visit is calm", () => {
    renderHook(() => useFreshBadges(earned));
    expect(window.localStorage.getItem(KEY)).toBe(JSON.stringify(earned));
  });

  it("shows nothing new when every badge has already been seen", () => {
    writeSeenBadges(JSON.stringify(earned));
    const { result } = renderHook(() => useFreshBadges(earned));
    expect(result.current).toEqual([]);
  });

  it("shows only the badge that is actually new", () => {
    writeSeenBadges(JSON.stringify(["first-climb"]));
    const { result } = renderHook(() => useFreshBadges(earned));
    expect(result.current).toEqual(["camp-mastered"]);
  });

  it("holds the spotlight for the life of the page, even after recording it", () => {
    const { result, rerender } = renderHook(() => useFreshBadges(earned));
    expect(result.current).toEqual(earned);
    rerender();
    // The store is not subscribed, so writing does not clear the spotlight
    // out from under the child mid-visit.
    expect(result.current).toEqual(earned);
  });

  it("shows nothing when nothing has been earned", () => {
    const { result } = renderHook(() => useFreshBadges([]));
    expect(result.current).toEqual([]);
  });

  it("does not lose a badge earned while the page was open", () => {
    const { result, rerender } = renderHook(({ ids }) => useFreshBadges(ids), {
      initialProps: { ids: ["first-climb"] as readonly BadgeId[] },
    });
    expect(result.current).toEqual(["first-climb"]);
    rerender({ ids: earned });
    expect(result.current).toEqual(earned);
  });
});
