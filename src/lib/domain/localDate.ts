import { z } from "zod";

/**
 * A calendar day in the *child's own* timezone, as `YYYY-MM-DD`.
 *
 * Streaks are the reason this type exists. A day boundary computed in UTC
 * would break a streak at 5pm for a child in California and hand one out early
 * to a child in Tokyo, so the local date is decided on the client and carried
 * across the boundary as a plain string rather than re-derived on the server.
 */
export type LocalDate = string & { readonly __localDate: unique symbol };

const SHAPE = /^\d{4}-\d{2}-\d{2}$/;

const MS_PER_DAY = 86_400_000;

/** True only for a well-formed date that actually exists (no 31 February). */
function isRealDate(value: string): boolean {
  if (!SHAPE.test(value)) return false;
  const asUtc = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(asUtc.getTime())) return false;
  // Round-tripping rejects the dates Date silently rolls over.
  return asUtc.toISOString().slice(0, 10) === value;
}

export const localDateSchema = z
  .string()
  .refine(isRealDate, "Expected a real calendar date as YYYY-MM-DD")
  .transform((value) => value as LocalDate);

/** Today, read from the browser's own clock and timezone. */
export function todayLocalDate(now: Date = new Date()): LocalDate {
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as LocalDate;
}

/**
 * Days since the epoch. Dates are anchored at UTC midnight purely as a
 * counting device — they already carry the child's local day — so this is
 * immune to DST, unlike arithmetic on a local Date.
 */
export function dayOrdinal(date: LocalDate): number {
  return Math.round(new Date(`${date}T00:00:00Z`).getTime() / MS_PER_DAY);
}

export function localDateFromOrdinal(ordinal: number): LocalDate {
  return new Date(ordinal * MS_PER_DAY).toISOString().slice(0, 10) as LocalDate;
}

/** How many days apart two local dates are, `later` minus `earlier`. */
export function daysBetween(earlier: LocalDate, later: LocalDate): number {
  return dayOrdinal(later) - dayOrdinal(earlier);
}

/** The run of dates ending at `last`, oldest first. Used to draw the calendar. */
export function recentDays(last: LocalDate, count: number): readonly LocalDate[] {
  const end = dayOrdinal(last);
  const days: LocalDate[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    days.push(localDateFromOrdinal(end - offset));
  }
  return days;
}
