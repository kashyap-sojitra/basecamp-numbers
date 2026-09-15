import { NextResponse } from "next/server";
import { z } from "zod";

export const errorResponseSchema = z.object({ error: z.string() });

/**
 * Validates a payload on the way out, so a bug cannot ship a bad shape.
 * CLAUDE.md requires Zod at every boundary, and outbound counts.
 */
export function json<T>(schema: z.ZodType<T>, payload: T, status: number): NextResponse {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    console.error("[api] refusing to send an invalid response", parsed.error.message);
    return NextResponse.json({ error: "Internal response validation failed" }, { status: 500 });
  }
  return NextResponse.json(parsed.data, { status });
}

export function fail(error: string, status: number): NextResponse {
  return json(errorResponseSchema, { error }, status);
}

/** A malformed body is indistinguishable from a missing one to every caller. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
