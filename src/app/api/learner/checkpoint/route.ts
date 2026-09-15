import { z } from "zod";
import { campNumberSchema } from "@/lib/domain/camp";
import { isDatabaseConfigured } from "@/lib/db/client";
import { refreshCamp } from "@/lib/db/learnerRepository";
import { readLearnerId } from "@/lib/learner/session";
import { fail, json, readJson } from "@/lib/api/respond";
import type { NextResponse } from "next/server";

const requestSchema = z.object({ camp: campNumberSchema });
const okResponseSchema = z.object({ restored: z.boolean() });

/**
 * A passed checkpoint. The reviewed camp is marked freshly practised, so its
 * meter springs back to what the child earned and the way up opens again.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = requestSchema.safeParse(await readJson(request));
  if (!body.success) {
    return fail("Expected a camp number", 400);
  }
  if (!isDatabaseConfigured()) {
    return fail("No database configured", 503);
  }

  const learnerId = await readLearnerId();
  if (learnerId === null) {
    return fail("No learner on this request", 401);
  }

  const restored = await refreshCamp(learnerId, body.data.camp);
  return json(okResponseSchema, { restored }, 200);
}
