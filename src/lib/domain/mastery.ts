import { z } from "zod";
import type { Mastery } from "@/lib/domain/camp";

export const MASTERY_MAX = 100;

/** A Mastery Meter reading as it crosses a boundary: whole, and in range. */
export const masterySchema = z.number().int().min(0).max(MASTERY_MAX);

/**
 * A camp opens the next one when its meter fills, which is the same moment the
 * child is told the camp is mastered. This reads the *earned* meter, not the
 * dimmed one, so decay never takes a camp away again — it only asks for a
 * review. Lives here rather than with decay to keep those two independent.
 */
export const UNLOCK_MASTERY = MASTERY_MAX;

/** A clean first landing is worth more than one found after a wobble. */
const GAIN_FIRST_TRY = 14;
const GAIN_AFTER_RETRY = 7;

/**
 * Mastery only ever rises here. Wrong answers cost nothing — the meter's
 * decay is a function of problems solved *elsewhere*, never of mistakes and
 * never of elapsed time, so a fortnight away from the app costs nothing.
 */
export function masteryGain(wrongAttempts: number): number {
  return wrongAttempts === 0 ? GAIN_FIRST_TRY : GAIN_AFTER_RETRY;
}

export function addMastery(current: Mastery, gain: number): Mastery {
  return Math.min(MASTERY_MAX, current + gain);
}

export function isCampComplete(mastery: Mastery): boolean {
  return mastery >= MASTERY_MAX;
}
