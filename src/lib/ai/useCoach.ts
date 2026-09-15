"use client";

import { useEffect, useState } from "react";
import type { z } from "zod";
import {
  encouragementSchema,
  framingSchema,
  summarySchema,
  type Encouragement,
  type EncouragementRequest,
  type FramingRequest,
  type SessionSummaryLine,
  type SummaryRequest,
  type WordProblemFraming,
} from "./types";
import { API } from "@/lib/routes";

interface Held<T> {
  readonly key: string;
  readonly value: T;
}

/**
 * Asks the coach endpoint for one line of writing. The endpoint always answers
 * — with a template when Gemini is unavailable — so the only state to handle
 * is "not back yet", during which the caller shows the bare numbers.
 *
 * `key` is the JSON of the request, and doubles as the request body, so the
 * effect's dependency and what it sends can never drift apart.
 */
function useCoachLine<T>(
  want: "framing" | "encouragement" | "summary",
  field: "framing" | "encouragement" | "summary",
  key: string | null,
  schema: z.ZodType<T>,
): T | null {
  const [held, setHeld] = useState<Held<T> | null>(null);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;

    async function load(requestKey: string) {
      try {
        const response = await fetch(API.coach, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: `{"want":"${want}","request":${requestKey}}`,
        });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        const envelope = payload as Record<string, unknown> | null;
        const parsed = schema.safeParse(envelope?.[field]);
        if (!cancelled && parsed.success) setHeld({ key: requestKey, value: parsed.data });
      } catch (error) {
        console.error(`[coach] no ${want} this time:`, error);
      }
    }

    void load(key);
    return () => { cancelled = true; };
  }, [want, field, key, schema]);

  // Anything held for a previous request is stale, so it is simply not shown.
  return held !== null && held.key === key ? held.value : null;
}

export function useWordProblem(request: FramingRequest | null): WordProblemFraming | null {
  return useCoachLine(
    "framing",
    "framing",
    request === null ? null : JSON.stringify(request),
    framingSchema,
  );
}

export function useEncouragement(request: EncouragementRequest | null): Encouragement | null {
  return useCoachLine(
    "encouragement",
    "encouragement",
    request === null ? null : JSON.stringify(request),
    encouragementSchema,
  );
}

export function useSessionSummary(request: SummaryRequest | null): SessionSummaryLine | null {
  return useCoachLine(
    "summary",
    "summary",
    request === null ? null : JSON.stringify(request),
    summarySchema,
  );
}
