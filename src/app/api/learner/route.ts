import { cookies } from "next/headers";
import { z } from "zod";
import { campNumberSchema } from "@/lib/domain/camp";
import { masterySchema } from "@/lib/domain/mastery";
import { localDateSchema, todayLocalDate } from "@/lib/domain/localDate";
import { climberProfileSchema } from "@/lib/domain/onboarding";
import { isDatabaseConfigured } from "@/lib/db/client";
import { recordSolve, saveProfile } from "@/lib/db/learnerRepository";
import {
  LEARNER_COOKIE,
  learnerCookieOptions,
  newLearnerId,
} from "@/lib/learner/learnerId";
import { readLearnerId } from "@/lib/learner/session";
import { fail, json, readJson } from "@/lib/api/respond";
import type { NextResponse } from "next/server";

/* -------------------------------------------------------------------------- */
/* Boundary schemas. Requests and responses are both validated, per CLAUDE.md. */

const profileRequestSchema = climberProfileSchema;

const masteryRequestSchema = z.object({
  camp: campNumberSchema,
  /**
   * Accepted and **ignored**. The client used to send the resulting meter and
   * the server wrote it down, so one crafted request could fill any camp. The
   * server now computes the gain itself from `clean`. Kept in the schema only
   * so a tab that was already open when this shipped still records its solves
   * instead of failing validation; drop it once that cannot be true.
   */
  mastery: masterySchema.optional(),
  /**
   * The child's own calendar day. Optional so that an older tab still records
   * its solve rather than losing it; the server's day is a poor substitute but
   * a better one than dropping the problem the child just did.
   */
  localDate: localDateSchema.optional(),
  /** Whether this one was right first time. Drives the accuracy badge. */
  clean: z.boolean().default(false),
});

const okResponseSchema = z.object({ saved: z.boolean() });

const NO_DATABASE =
  "No database configured. Copy .env.example to .env.local, add your Neon DATABASE_URL, then run npm run db:migrate.";

/* -------------------------------------------------------------------------- */

/**
 * Saves the learner's grade band and interest theme, minting the anonymous
 * learner cookie on a first visit. This is the only place a learner id is
 * created.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = profileRequestSchema.safeParse(await readJson(request));
  if (!body.success) {
    return fail("Expected a grade band and an interest theme", 400);
  }

  // Say so plainly rather than accepting picks that cannot be kept.
  if (!isDatabaseConfigured()) {
    return fail(NO_DATABASE, 503);
  }

  const existing = await readLearnerId();
  const learnerId = existing ?? newLearnerId();

  const saved = await saveProfile(learnerId, body.data);

  if (existing === null) {
    // Set even when the write failed, so the child keeps one identity for the
    // rest of the visit rather than minting a new id on every attempt.
    const store = await cookies();
    store.set(LEARNER_COOKIE, learnerId, learnerCookieOptions());
  }

  return json(okResponseSchema, { saved }, 200);
}

/**
 * Records one solved problem. Sending this *is* the solve event: the learner's
 * total goes up, the camp is marked freshly practised, and every other camp
 * grows a problem staler as a result.
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  const body = masteryRequestSchema.safeParse(await readJson(request));
  if (!body.success) {
    return fail("Expected a camp number and whether it was clean", 400);
  }

  if (!isDatabaseConfigured()) {
    return fail(NO_DATABASE, 503);
  }

  const learnerId = await readLearnerId();
  if (learnerId === null) {
    return fail("No learner on this request", 401);
  }

  const saved = await recordSolve(learnerId, {
    camp: body.data.camp,
    localDate: body.data.localDate ?? todayLocalDate(),
    clean: body.data.clean,
  });
  return json(okResponseSchema, { saved }, 200);
}
