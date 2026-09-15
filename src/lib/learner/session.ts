import "server-only";

import { cookies } from "next/headers";
import { LEARNER_COOKIE, learnerIdSchema, type LearnerId } from "./learnerId";

/**
 * The learner this request belongs to, or null for a first-time visitor. The
 * cookie value is validated: a hand-edited or stale cookie reads as no learner
 * rather than becoming a bad database lookup.
 */
export async function readLearnerId(): Promise<LearnerId | null> {
  const store = await cookies();
  const parsed = learnerIdSchema.safeParse(store.get(LEARNER_COOKIE)?.value);
  return parsed.success ? parsed.data : null;
}
