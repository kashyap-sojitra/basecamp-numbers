import { z } from "zod";
import { interestThemeSchema } from "@/lib/domain/onboarding";

/**
 * What a word problem is framing. The numbers are always supplied by the
 * generators, never invented here — the model dresses them up and nothing
 * more.
 */
export const framingRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("jump"),
    theme: interestThemeSchema,
    operation: z.enum(["add", "subtract"]),
    start: z.number().int().min(0).max(10_000),
    change: z.number().int().min(1).max(10_000),
  }),
  z.object({
    kind: z.literal("array"),
    theme: interestThemeSchema,
    rows: z.number().int().min(1).max(20),
    cols: z.number().int().min(1).max(20),
  }),
  z.object({
    kind: z.literal("place-value"),
    theme: interestThemeSchema,
    target: z.number().int().min(1).max(10_000),
  }),
  /*
   * Camp 4: the mat shows a number the long way and the child works out its
   * value. The operands are therefore the *counts* — 7 bags of ten and 14
   * loose — and the target is the answer, which the story must never say.
   * Zero counts are allowed and simply not told.
   */
  z.object({
    kind: z.literal("trade-up"),
    theme: interestThemeSchema,
    piles: z
      .array(
        z.object({
          unit: z.union([z.literal(1000), z.literal(100), z.literal(10), z.literal(1)]),
          count: z.number().int().min(0).max(99),
        }),
      )
      .min(1)
      .max(4),
    target: z.number().int().min(1).max(100_000),
  }),
]);

export type FramingRequest = z.infer<typeof framingRequestSchema>;

/** Where a line came from, so the UI and the tests can tell them apart. */
const lineSourceSchema = z.enum(["gemini", "template"]);

export const framingSchema = z.object({
  /** One or two short sentences setting the scene. */
  story: z.string().min(1).max(240),
  /** The question put to the child. */
  question: z.string().min(1).max(160),
  source: lineSourceSchema,
});

export type WordProblemFraming = z.infer<typeof framingSchema>;

/** How the child's last answer went. */
const answerOutcomeSchema = z.enum([
  "correct-first-try",
  "correct-after-retry",
  "incorrect",
]);
export type AnswerOutcomeKind = z.infer<typeof answerOutcomeSchema>;

export const encouragementRequestSchema = z.object({
  theme: interestThemeSchema,
  outcome: answerOutcomeSchema,
  /** The local, deterministic hint this line should echo, if any. */
  hint: z.string().max(200).optional(),
});
export type EncouragementRequest = z.infer<typeof encouragementRequestSchema>;

export const encouragementSchema = z.object({
  line: z.string().min(1).max(140),
  source: lineSourceSchema,
});
export type Encouragement = z.infer<typeof encouragementSchema>;

/**
 * What a session summary line has to work from. Deliberately qualitative: the
 * screen shows the numbers itself, so the line describes *what improved* and
 * mentions no figures at all.
 */
export const summaryRequestSchema = z.object({
  theme: interestThemeSchema,
  /** What the camp practises, in plain words, e.g. "jumps across a ten". */
  skill: z.string().min(1).max(80),
  /** How the sitting went overall. */
  shape: z.enum(["strong", "steady", "wobbly", "nothing"]),
  /** True when the camp's meter rose during this sitting. */
  masteryRose: z.boolean(),
  /** True when the child finished the camp in this sitting. */
  campCompleted: z.boolean(),
  /**
   * The slips made in this sitting, oldest first — `off-by-one`,
   * `needs-regroup` and so on. This is what lets the line say what the child
   * *got better at*: a four-way "strong / steady / wobbly" cannot tell them
   * they stopped counting the starting tick, and a list of diagnoses can.
   * Bounded and validated like any other boundary value.
   */
  slips: z.array(z.string().min(1).max(40)).max(16).default([]),
});
export type SummaryRequest = z.infer<typeof summaryRequestSchema>;

export const summarySchema = z.object({
  line: z.string().min(1).max(160),
  source: lineSourceSchema,
});
export type SessionSummaryLine = z.infer<typeof summarySchema>;
