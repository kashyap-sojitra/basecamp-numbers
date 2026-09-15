import { z } from "zod";
import {
  encouragementRequestSchema,
  encouragementSchema,
  framingRequestSchema,
  framingSchema,
  summaryRequestSchema,
  summarySchema,
} from "@/lib/ai/types";
import {
  generateEncouragement,
  generateSessionSummary,
  generateWordProblem,
} from "@/lib/ai/wordProblemGenerator";
import { fail, json, readJson } from "@/lib/api/respond";
import type { NextResponse } from "next/server";

/**
 * The coach: word-problem framing and encouragement lines. Kept on the server
 * because the Gemini key must never reach a browser, and because the fallback
 * template bank lives server-side too.
 */

const requestSchema = z.discriminatedUnion("want", [
  z.object({ want: z.literal("framing"), request: framingRequestSchema }),
  z.object({ want: z.literal("encouragement"), request: encouragementRequestSchema }),
  z.object({ want: z.literal("summary"), request: summaryRequestSchema }),
]);

const responseSchema = z.discriminatedUnion("want", [
  z.object({ want: z.literal("framing"), framing: framingSchema }),
  z.object({ want: z.literal("encouragement"), encouragement: encouragementSchema }),
  z.object({ want: z.literal("summary"), summary: summarySchema }),
]);

export async function POST(request: Request): Promise<NextResponse> {
  const body = requestSchema.safeParse(await readJson(request));
  if (!body.success) {
    return fail("Expected a framing, encouragement or summary request", 400);
  }

  if (body.data.want === "framing") {
    const framing = await generateWordProblem(body.data.request);
    return json(responseSchema, { want: "framing", framing }, 200);
  }

  if (body.data.want === "encouragement") {
    const encouragement = await generateEncouragement(body.data.request);
    return json(responseSchema, { want: "encouragement", encouragement }, 200);
  }

  const summary = await generateSessionSummary(body.data.request);
  return json(responseSchema, { want: "summary", summary }, 200);
}
