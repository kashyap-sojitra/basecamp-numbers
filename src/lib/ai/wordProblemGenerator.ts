import "server-only";

import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { checkFraming } from "./framingGuard";
import { templateEncouragement, templateFraming, templateSummary, pilesInWords } from "./templates";
import {
  type Encouragement,
  type EncouragementRequest,
  type FramingRequest,
  type SessionSummaryLine,
  type SummaryRequest,
  type WordProblemFraming,
} from "./types";
import { castFor } from "./cast";

/**
 * The only module in the app that talks to Gemini, and the only one that may
 * import `@google/genai`.
 *
 * Gemini is used for *words* alone — the story around a problem and a kind
 * line after an answer. Every number comes from the deterministic generators,
 * and anything the model returns is checked against those numbers before it is
 * shown: a framing that states the answer, invents a number, or drops an
 * operand is thrown away in favour of the local template bank.
 *
 * The template bank is also the answer to a missing key, a slow call, an
 * error, or a rate limit, so this module never fails — it degrades.
 */

/**
 * Verified against the live API: `gemini-2.5-flash` now 404s for new keys, and
 * `gemini-flash-latest` was returning 503s. Override with GEMINI_MODEL.
 */
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

/**
 * Measured round trips are around 1.9s, so the old 2.5s and 1.5s budgets cut
 * nearly every call off. The child is never blocked by these — the bare sum
 * and the local line show immediately and are replaced when the words land —
 * so the budget can be generous without costing anyone a wait.
 */
const FRAMING_TIMEOUT_MS = 6_000;
const ENCOURAGEMENT_TIMEOUT_MS = 5_000;

/**
 * The free tier allows about five generateContent calls a minute per model
 * (the 429 body states the figure). A rolling budget just under that stops us
 * spending requests on calls that would only come back 429 — every one we
 * skip is served instantly from the template bank instead.
 */
const MAX_CALLS_PER_MINUTE = Number(process.env.GEMINI_MAX_CALLS_PER_MINUTE ?? "4");
const RATE_WINDOW_MS = 60_000;

/** A small gap on top, so a burst cannot fire them all at once. */
const MIN_CALL_GAP_MS = 1_000;
/** Consecutive failures before the breaker opens. */
const FAILURE_LIMIT = 3;
/** How long to stay on templates once it does. */
const COOLDOWN_MS = 60_000;
/** Framings held in memory, so a repeated problem costs nothing. */
const CACHE_LIMIT = 200;

/* -------------------------------------------------------------------------- */
/* Guardrails                                                                 */

interface Breaker {
  lastCallAt: number;
  consecutiveFailures: number;
  openUntil: number;
  /** When each recent call went out, for the rolling budget. */
  recentCalls: number[];
}

const breaker: Breaker = {
  lastCallAt: 0,
  consecutiveFailures: 0,
  openUntil: 0,
  recentCalls: [],
};

function apiKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  return key === undefined || key.length === 0 ? null : key;
}

/** True when a call may be attempted at all. */
function canCall(now: number): boolean {
  if (apiKey() === null) return false;
  if (now < breaker.openUntil) return false;
  if (now - breaker.lastCallAt < MIN_CALL_GAP_MS) return false;

  // Drop anything older than the window, then check what is left.
  breaker.recentCalls = breaker.recentCalls.filter((at) => now - at < RATE_WINDOW_MS);
  return breaker.recentCalls.length < MAX_CALLS_PER_MINUTE;
}

function noteSuccess(): void {
  breaker.consecutiveFailures = 0;
}

/** A rate limit trips the breaker at once; other errors take three strikes. */
function noteFailure(error: unknown, now: number): void {
  const text = error instanceof Error ? error.message : String(error);
  const rateLimited = /429|rate.?limit|quota|resource.?exhausted/i.test(text);

  breaker.consecutiveFailures += 1;
  if (rateLimited || breaker.consecutiveFailures >= FAILURE_LIMIT) {
    breaker.openUntil = now + COOLDOWN_MS;
    breaker.consecutiveFailures = 0;
    console.warn(`[ai] pausing Gemini for ${String(COOLDOWN_MS / 1000)}s: ${text}`);
  }
}

/** Test seam: forget any open breaker and pacing. */
export function resetAiGuardsForTests(): void {
  breaker.lastCallAt = 0;
  breaker.consecutiveFailures = 0;
  breaker.openUntil = 0;
  breaker.recentCalls = [];
  cache.clear();
}

const cache = new Map<string, WordProblemFraming>();

function cacheKey(request: FramingRequest): string {
  return JSON.stringify(request);
}

/* -------------------------------------------------------------------------- */
/* Gemini                                                                     */

let client: GoogleGenAI | null = null;

function genai(key: string): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: key });
  return client;
}

const FRAMING_SYSTEM = [
  "You write one-line word problems for children aged 5 to 11.",
  "You are given a character. Write the story about that character, by name, and keep them in character.",
  "You are given the exact numbers to use. Use every number given, and never any other number.",
  "Never state, compute, hint at or imply the answer.",
  "Keep the story to one short sentence and the question to one short sentence.",
  "Plain words only: no markdown, no emoji, no digits spelled as words.",
].join(" ");

const SUMMARY_SYSTEM = [
  "You write one line for a child aged 5 to 11 at the end of a maths practice session.",
  "Say what they got better at, in their own terms, warmly and without gushing.",
  "At most 20 words, one sentence.",
  "Never mention any number, score, count or percentage — the screen shows those already.",
  "Plain words only: no markdown, no emoji.",
].join(" ");

const ENCOURAGEMENT_SYSTEM = [
  "You write a single short line of encouragement for a child aged 5 to 11 doing maths.",
  "Warm, specific, never gushing, never babyish, at most 12 words.",
  // The diagnosis is arithmetic and is computed locally; the model's job is
  // to say it like a kind teacher, not to work out what went wrong.
  "When you are told what the child's slip was, say *that* back to them in their own terms — the specific thing to fix, not general sympathy.",
  "Never mention numbers, never give away an answer, never scold.",
  "Plain words only: no markdown, no emoji.",
].join(" ");

function framingPrompt(request: FramingRequest): string {
  // The same friend the template bank would have picked for this problem, so
  // the cast is the child's either way and a fallback is not a change of cast.
  const who = castFor(request);
  const theme = `Theme it around ${request.theme}. The character is ${who.name}, ${who.note}.`;
  switch (request.kind) {
    case "jump":
      return `${theme} ${who.name} starts with ${String(request.start)} things and ${
        request.operation === "add" ? "gains" : "loses"
      } ${String(request.change)} more. Use only the numbers ${String(request.start)} and ${String(request.change)}. Ask how many there are ${request.operation === "add" ? "now" : "left"}.`;
    case "array":
      return `${theme} ${who.name} arranges things in ${String(request.rows)} rows of ${String(request.cols)}. Use only the numbers ${String(request.rows)} and ${String(request.cols)}. Ask how many there are altogether.`;
    case "place-value":
      return `${theme} ${who.name} needs to gather exactly ${String(request.target)} things. Use only the number ${String(request.target)}. Ask them to build ${String(request.target)} out of blocks.`;
    case "trade-up":
    {
      const told = request.piles.filter((pile) => pile.count > 0);
      const counts = told.map((pile) => String(pile.count)).join(", ");
      return `${theme} ${who.name} has packed things into groups: ${pilesInWords(request.piles)}. Use only the numbers ${counts}; write "ten", "hundred" and "thousand" as words. Ask how many there are altogether, and never say the total.`;
    }
  }
}

const modelFramingSchema = z.object({ story: z.string(), question: z.string() });

/** Runs a prompt with a hard deadline, returning null on any failure. */
async function ask(
  key: string,
  system: string,
  prompt: string,
  timeoutMs: number,
  schemaProperties: Record<string, { type: "string" }>,
  required: readonly string[],
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => { controller.abort(); }, timeoutMs);
  const now = Date.now();
  breaker.lastCallAt = now;
  breaker.recentCalls.push(now);

  try {
    const response = await genai(key).models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: system,
        abortSignal: controller.signal,
        temperature: 1,
        maxOutputTokens: 200,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: schemaProperties,
          required: [...required],
        },
        // These are one-liners, so the least thinking available. Note that
        // `thinkingBudget` is rejected outright (400) by 3.5+ models, and
        // omitting the config entirely makes the model prefix its JSON with
        // prose that then fails to parse.
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
    });
    noteSuccess();
    return response.text ?? null;
  } catch (error) {
    noteFailure(error, now);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */

/**
 * A themed word problem for a problem the generators already decided. Falls
 * back to the template bank whenever Gemini cannot be used or returns
 * something that does not survive `checkFraming`.
 */
export async function generateWordProblem(
  request: FramingRequest,
): Promise<WordProblemFraming> {
  const cached = cache.get(cacheKey(request));
  if (cached !== undefined) return cached;

  const key = apiKey();
  const fallback = templateFraming(request);
  if (key === null || !canCall(Date.now())) return fallback;

  const raw = await ask(
    key,
    FRAMING_SYSTEM,
    framingPrompt(request),
    FRAMING_TIMEOUT_MS,
    { story: { type: "string" }, question: { type: "string" } },
    ["story", "question"],
  );
  if (raw === null) return fallback;

  let parsedJson: unknown = null;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return fallback;
  }

  const parsed = modelFramingSchema.safeParse(parsedJson);
  if (!parsed.success) return fallback;

  const story = parsed.data.story.trim();
  const question = parsed.data.question.trim();
  const verdict = checkFraming(request, story, question);
  if (!verdict.ok) {
    console.warn(`[ai] rejected a Gemini framing: ${verdict.reason}`);
    return fallback;
  }
  if (story.length > 240 || question.length > 160) return fallback;

  const framing: WordProblemFraming = { story, question, source: "gemini" };
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(cacheKey(request), framing);
  return framing;
}

/** A short line after an answer. Never mentions numbers, so nothing to check. */
export async function generateEncouragement(
  request: EncouragementRequest,
): Promise<Encouragement> {
  const key = apiKey();
  const fallback = templateEncouragement(request);
  if (key === null || !canCall(Date.now())) return fallback;

  const outcome =
    request.outcome === "incorrect"
      ? "They answered wrongly and will try again"
      : request.outcome === "correct-first-try"
        ? "They answered correctly on the first try"
        : "They answered correctly after a wobble";
  const hint =
    request.hint === undefined
      ? ""
      : ` We worked out exactly what their slip was: "${request.hint}" Say that to them warmly, in your own words.`;

  const raw = await ask(
    key,
    ENCOURAGEMENT_SYSTEM,
    `${outcome}. Theme: ${request.theme}.${hint} Write one line for them.`,
    ENCOURAGEMENT_TIMEOUT_MS,
    { line: { type: "string" } },
    ["line"],
  );
  if (raw === null) return fallback;

  try {
    const parsed = z.object({ line: z.string() }).safeParse(JSON.parse(raw));
    if (!parsed.success) return fallback;
    const line = parsed.data.line.trim();
    // A line with digits in it risks contradicting the real arithmetic.
    if (line.length === 0 || line.length > 140 || /\d/.test(line) || /[*_#`|<>{}]/.test(line)) {
      return fallback;
    }
    return { line, source: "gemini" };
  } catch {
    return fallback;
  }
}

/**
 * One line about what the child improved at. Numbers are forbidden here — the
 * summary screen shows the stars and the meters itself, and a model-written
 * figure could contradict them.
 */
export async function generateSessionSummary(
  request: SummaryRequest,
): Promise<SessionSummaryLine> {
  const key = apiKey();
  const fallback = templateSummary(request);
  if (key === null || !canCall(Date.now())) return fallback;

  const shape =
    request.shape === "strong"
      ? "They were quick and mostly right first time"
      : request.shape === "steady"
        ? "They worked steadily with a few retries"
        : request.shape === "wobbly"
          ? "They needed several attempts but kept going"
          : "They did not finish any problems";

  /*
   * The slips are the useful part. Told in order, the model can see a slip
   * that stopped happening — which is the difference between "nice work" and
   * "you stopped counting the start tick, that's the hard part done".
   */
  const slips =
    request.slips.length === 0
      ? "They made no mistakes at all."
      : `Their mistakes, oldest first, were: ${request.slips.join(", ")}. If one of those stopped happening as they went, that is what they got better at — say that.`;

  const prompt = [
    `The child practised: ${request.skill}.`,
    `${shape}.`,
    slips,
    request.masteryRose ? "Their mastery meter rose." : "Their mastery meter did not move.",
    request.campCompleted ? "They finished the camp." : "",
    `Theme: ${request.theme}.`,
    "Write one line telling them what they got better at.",
  ]
    .filter((part) => part.length > 0)
    .join(" ");

  const raw = await ask(key, SUMMARY_SYSTEM, prompt, ENCOURAGEMENT_TIMEOUT_MS, { line: { type: "string" } }, ["line"]);
  if (raw === null) return fallback;

  try {
    const parsed = z.object({ line: z.string() }).safeParse(JSON.parse(raw));
    if (!parsed.success) return fallback;
    const line = parsed.data.line.trim();
    // A figure here could contradict the stars and meters on screen.
    if (line.length === 0 || line.length > 160 || /\d/.test(line) || /[*_#`|<>{}]/.test(line)) {
      return fallback;
    }
    return { line, source: "gemini" };
  } catch {
    return fallback;
  }
}
