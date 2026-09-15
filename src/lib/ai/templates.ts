import { createRng, hashSeed, type Rng } from "@/lib/math/rng";
import type {
  AnswerOutcomeKind,
  Encouragement,
  EncouragementRequest,
  FramingRequest,
  SessionSummaryLine,
  SummaryRequest,
  WordProblemFraming,
} from "./types";
import { castFor, seedFor, THEME_CAST } from "./cast";

/**
 * The local template bank. This is the app's floor: whenever Gemini is absent,
 * slow, failing or rate-limited, every child still gets a themed word problem
 * and a kind word. Seeded from the problem itself, so the same problem always
 * gets the same story and nothing flickers on a re-render.
 */


function pickFrom(rng: Rng, items: readonly [string, ...string[]]): string {
  return rng.pick(items);
}

/** Some actors are "the monkey", so a sentence built from one needs a nudge. */
function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}


export function templateFraming(request: FramingRequest): WordProblemFraming {
  const rng = createRng(seedFor(request));
  const words = THEME_CAST[request.theme];
  // The same cast the model is given, so a child meets the same friends
  // whether or not Gemini answered.
  const actor = castFor(request).name;
  const things = pickFrom(rng, words.things);

  switch (request.kind) {
    case "jump": {
      const story = sentence(
        request.operation === "add"
          ? `${actor} had ${String(request.start)} ${things}, then found ${String(request.change)} more near ${words.place}.`
          : `${actor} had ${String(request.start)} ${things} and gave ${String(request.change)} away at ${words.place}.`,
      );
      const question =
        request.operation === "add"
          ? `How many ${things} now?`
          : `How many ${things} are left?`;
      return { story, question, source: "template" };
    }
    case "array": {
      const story = sentence(
        `${actor} is laying out ${things} in ${String(request.rows)} neat rows of ${String(request.cols)}.`,
      );
      return { story, question: `How many ${things} altogether?`, source: "template" };
    }
    case "place-value": {
      const story = sentence(
        `${actor} needs to pack exactly ${String(request.target)} ${things} for the trip.`,
      );
      return { story, question: `Can you build ${String(request.target)} with the blocks?`, source: "template" };
    }
    case "trade-up": {
      // A real word problem whose operands are the counts on the mat — the
      // groups the things were packed into — and whose answer is the value,
      // which is never said. "Ten", "hundred" and "thousand" stay words: the
      // guard reads digits as numbers, and the only digits allowed are the
      // counts.
      const story = sentence(`${actor} packed the ${things}: ${pilesInWords(request.piles)}.`);
      return {
        story,
        question: `How many ${things} are there altogether?`,
        source: "template",
      };
    }
  }
}

/** What one of each place is packed into, for the story. Words, never digits. */
const PACKED_AS: Record<1000 | 100 | 10 | 1, { readonly one: string; readonly many: string }> = {
  1000: { one: "crate of a thousand", many: "crates of a thousand" },
  100: { one: "box of a hundred", many: "boxes of a hundred" },
  10: { one: "bag of ten", many: "bags of ten" },
  1: { one: "loose", many: "loose" },
};

/** "7 bags of ten and 14 loose"; empty places are left out. */
export function pilesInWords(
  piles: readonly { readonly unit: 1000 | 100 | 10 | 1; readonly count: number }[],
): string {
  const parts = piles
    .filter((pile) => pile.count > 0)
    .map((pile) => `${String(pile.count)} ${pile.count === 1 ? PACKED_AS[pile.unit].one : PACKED_AS[pile.unit].many}`);
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1] ?? ""}`;
}

const ENCOURAGEMENT: Record<AnswerOutcomeKind, readonly [string, ...string[]]> = {
  "correct-first-try": [
    "Straight there — brilliant.",
    "First time. You knew that one.",
    "Spot on, and quick too.",
    "That is exactly it. Lovely work.",
  ],
  "correct-after-retry": [
    "You stuck with it and got there.",
    "Found it. That is what counts.",
    "Worked it out — well climbed.",
    "Second look did it. Nice thinking.",
  ],
  incorrect: [
    "Not quite yet — have another go.",
    "Close. Try once more.",
    "Good try. Let us look again.",
    "Almost. One more attempt.",
  ],
};

export function templateEncouragement(request: EncouragementRequest): Encouragement {
  // Varies per call on purpose: a repeated stock phrase reads like a robot.
  const rng = createRng(hashSeed(`enc:${request.outcome}:${String(Date.now())}`));
  return { line: pickFrom(rng, ENCOURAGEMENT[request.outcome]), source: "template" };
}

/** Local summary lines, one per shape of sitting. */
const SUMMARY: Record<SummaryRequest["shape"], readonly [string, ...string[]]> = {
  strong: [
    "You were quick and sure on {skill} today.",
    "{skill} looked easy for you this time.",
    "You barely paused on {skill}.",
  ],
  steady: [
    "You kept working at {skill} and it moved.",
    "Solid practice on {skill} today.",
    "{skill} is coming along nicely.",
  ],
  wobbly: [
    "{skill} took some thinking today, and you stayed with it.",
    "You worked hard on {skill}. That is the part that counts.",
    "{skill} is still settling — you kept going anyway.",
  ],
  nothing: [
    "Nothing climbed this time. The mountain will keep.",
    "Come back when you are ready — camp is waiting.",
  ],
};

export function templateSummary(request: SummaryRequest): SessionSummaryLine {
  const rng = createRng(hashSeed(`sum:${request.shape}:${request.skill}:${String(Date.now())}`));
  const pattern = pickFrom(rng, SUMMARY[request.shape]);
  const line = sentence(pattern.replace("{skill}", request.skill));
  const finished = request.campCompleted ? " And you finished the camp!" : "";
  return { line: `${line}${finished}`.slice(0, 160), source: "template" };
}
