import { z } from "zod";

/** Cookie holding the anonymous learner's UUID. No login, ever. */
export const LEARNER_COOKIE = "bn_learner";

/** A year — long enough that a child keeps their mountain between terms. */
export const LEARNER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** The cookie is untrusted input like any other, so it is parsed, not read. */
export const learnerIdSchema = z.uuid();

export type LearnerId = z.infer<typeof learnerIdSchema>;

export function newLearnerId(): LearnerId {
  return crypto.randomUUID();
}

/** Cookie attributes. `httpOnly` keeps the id out of page scripts entirely. */
export function learnerCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  maxAge: number;
  secure: boolean;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: LEARNER_COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  };
}
