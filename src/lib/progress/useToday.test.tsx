import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useToday } from "./useToday";
import { localDateSchema, todayLocalDate } from "@/lib/domain/localDate";

const SERVER_DAY = localDateSchema.parse("2020-01-01");

describe("useToday", () => {
  it("reads the browser's own day, not the server's guess", () => {
    const { result } = renderHook(() => useToday(SERVER_DAY));
    expect(result.current).toBe(todayLocalDate());
    expect(result.current).not.toBe(SERVER_DAY);
  });

  it("returns a valid local date", () => {
    const { result } = renderHook(() => useToday(SERVER_DAY));
    expect(localDateSchema.safeParse(result.current).success).toBe(true);
  });

  it("stays stable across re-renders, so the screen agrees with itself", () => {
    const { result, rerender } = renderHook(() => useToday(SERVER_DAY));
    const first = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(first);
  });

  it("follows the system clock's timezone rather than UTC", () => {
    // Late local evening: UTC has already rolled over for much of the world.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 8, 11, 23, 45));
      const { result } = renderHook(() => useToday(SERVER_DAY));
      expect(result.current).toBe("2026-09-11");
    } finally {
      vi.useRealTimers();
    }
  });
});
