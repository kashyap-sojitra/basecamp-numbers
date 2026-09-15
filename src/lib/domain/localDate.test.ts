import { describe, expect, it } from "vitest";
import {
  dayOrdinal,
  daysBetween,
  localDateFromOrdinal,
  localDateSchema,
  recentDays,
  todayLocalDate,
} from "./localDate";

const d = (value: string) => localDateSchema.parse(value);

describe("localDateSchema", () => {
  it("accepts real calendar days", () => {
    for (const value of ["2026-09-11", "2026-02-28", "2024-02-29", "1999-12-31"]) {
      expect(localDateSchema.parse(value)).toBe(value);
    }
  });

  it("refuses days that do not exist", () => {
    for (const bad of ["2026-02-30", "2026-02-29", "2026-13-01", "2026-00-10", "2026-04-31"]) {
      expect(localDateSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("refuses anything that is not a padded ISO day", () => {
    for (const bad of ["2026-2-03", "2026-02-3", "26-02-03", "2026/02/03", "", "today", 20260203, null]) {
      expect(localDateSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("refuses a timestamp, since a day is not an instant", () => {
    expect(localDateSchema.safeParse("2026-09-11T10:00:00Z").success).toBe(false);
  });
});

describe("todayLocalDate", () => {
  it("reads the browser's own calendar, not UTC", () => {
    expect(todayLocalDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("pads single-digit months and days", () => {
    expect(todayLocalDate(new Date(2026, 8, 3))).toBe("2026-09-03");
  });

  it("stays on the local day late at night, when UTC has already rolled over", () => {
    // 23:30 local is the next day in UTC for any timezone east of London.
    expect(todayLocalDate(new Date(2026, 8, 11, 23, 30))).toBe("2026-09-11");
  });

  it("stays on the local day early in the morning", () => {
    expect(todayLocalDate(new Date(2026, 8, 11, 0, 15))).toBe("2026-09-11");
  });
});

describe("day arithmetic", () => {
  it("round-trips every ordinal in a five-year window", () => {
    for (let ordinal = 19_000; ordinal < 21_000; ordinal += 1) {
      expect(dayOrdinal(localDateFromOrdinal(ordinal))).toBe(ordinal);
    }
  });

  it("counts one day between consecutive days", () => {
    expect(daysBetween(d("2026-03-01"), d("2026-03-02"))).toBe(1);
  });

  it("counts across a year boundary", () => {
    expect(daysBetween(d("2025-12-31"), d("2026-01-01"))).toBe(1);
  });

  it("counts across February, leap and not", () => {
    expect(daysBetween(d("2026-02-28"), d("2026-03-01"))).toBe(1);
    expect(daysBetween(d("2024-02-28"), d("2024-03-01"))).toBe(2);
  });

  it("is immune to daylight saving, in both directions", () => {
    // US spring forward and fall back, 2026.
    expect(daysBetween(d("2026-03-07"), d("2026-03-09"))).toBe(2);
    expect(daysBetween(d("2026-10-31"), d("2026-11-02"))).toBe(2);
    // ...and the EU dates, which differ.
    expect(daysBetween(d("2026-03-28"), d("2026-03-30"))).toBe(2);
    expect(daysBetween(d("2026-10-24"), d("2026-10-26"))).toBe(2);
  });

  it("is negative when the later date comes first", () => {
    expect(daysBetween(d("2026-03-02"), d("2026-03-01"))).toBe(-1);
  });

  it("is zero for the same day", () => {
    expect(daysBetween(d("2026-03-02"), d("2026-03-02"))).toBe(0);
  });
});

describe("recentDays", () => {
  it("returns the run ending at the given day, oldest first", () => {
    expect(recentDays(d("2026-03-01"), 3)).toEqual(["2026-02-27", "2026-02-28", "2026-03-01"]);
  });

  it("returns exactly the number of days asked for", () => {
    for (const count of [1, 7, 14, 30]) {
      expect(recentDays(d("2026-09-11"), count)).toHaveLength(count);
    }
  });

  it("returns consecutive days with no gaps or repeats", () => {
    const days = recentDays(d("2026-03-09"), 14);
    for (let i = 1; i < days.length; i += 1) {
      const previous = days[i - 1];
      const current = days[i];
      if (previous === undefined || current === undefined) throw new Error("bad run");
      expect(daysBetween(previous, current)).toBe(1);
    }
    expect(new Set(days).size).toBe(days.length);
  });

  it("ends on the day it was given", () => {
    expect(recentDays(d("2026-09-11"), 14).at(-1)).toBe("2026-09-11");
  });
});
