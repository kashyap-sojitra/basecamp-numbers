import { createRng, hashSeed } from "@/lib/math/rng";
import type { InterestTheme } from "@/lib/domain/onboarding";
import type { FramingRequest } from "./types";

/**
 * The recurring cast, shared by the model and the template bank so a child
 * meets the same friends whether or not Gemini answered.
 *
 * Original characters on purpose: borrowing the cartoon characters children
 * know would ship someone else's trademarks in a product for children.
 * Familiarity comes from recurrence instead.
 *
 * A name must never contain a digit — the framing guard checks every number in
 * a story against the ones we supplied, so "R2" reads as an invented number.
 */

export interface Character {
  /** How the character is named in a sentence. */
  readonly name: string;
  /** A few words for the model, so it writes them in character. */
  readonly note: string;
  /**
   * The face that rides the number line. The story said "Pip the robot needs
   * twelve stars" and then the board showed a generic theme emoji, so the
   * friend a child was reading about never actually turned up. Display only —
   * it is never sent to the model.
   */
  readonly glyph: string;
}

export interface ThemeCast {
  readonly characters: readonly [Character, ...Character[]];
  readonly things: readonly [string, ...string[]];
  readonly place: string;
}

export const THEME_CAST: Record<InterestTheme, ThemeCast> = {
  space: {
    characters: [
      { name: "Captain Luna", note: "a brave astronaut who leads the crew" , glyph: "👩‍🚀"},
      { name: "Pip the robot", note: "a small, cheerful robot who counts everything" , glyph: "🤖"},
      { name: "Comet the space dog", note: "a bouncy dog in a tiny spacesuit" , glyph: "🐕"},
      { name: "Astronaut Bo", note: "a careful astronaut who checks things twice" , glyph: "🧑‍🚀"},
    ],
    things: ["moon rocks", "stars", "comet chips", "fuel cells"],
    place: "the launch pad",
  },
  ocean: {
    characters: [
      { name: "Pearl the diver", note: "a curious diver who explores the reef" , glyph: "🤿"},
      { name: "Captain Finn", note: "a cheerful sailor with a red boat" , glyph: "⛵"},
      { name: "Bubbles the octopus", note: "a clumsy octopus with eight busy arms" , glyph: "🐙"},
      { name: "Splash the dolphin", note: "a playful dolphin who loves races" , glyph: "🐬"},
    ],
    things: ["shells", "bubbles", "pebbles", "sea stars"],
    place: "the reef",
  },
  jungle: {
    characters: [
      { name: "Mira the ranger", note: "a kind ranger who looks after the forest" , glyph: "🧭"},
      { name: "Toco the toucan", note: "a loud toucan with a huge orange beak" , glyph: "🦜"},
      { name: "Coco the monkey", note: "a cheeky monkey who is always hungry" , glyph: "🐒"},
      { name: "Rumble the tiger cub", note: "a sleepy tiger cub learning to pounce" , glyph: "🐯"},
    ],
    things: ["bananas", "mangoes", "seeds", "bright feathers"],
    place: "the treehouse",
  },
};

/**
 * A stable seed for one problem, so its story and its cast never change under
 * it — the same problem always gets the same friend.
 */
export function seedFor(request: FramingRequest): number {
  switch (request.kind) {
    case "jump":
      return hashSeed(
        `jump:${request.theme}:${request.operation}:${String(request.start)}:${String(request.change)}`,
      );
    case "array":
      return hashSeed(`array:${request.theme}:${String(request.rows)}:${String(request.cols)}`);
    case "place-value":
      return hashSeed(`pv:${request.theme}:${String(request.target)}`);
    case "trade-up":
      return hashSeed(
        `trade:${request.theme}:${request.piles.map((p) => `${String(p.unit)}x${String(p.count)}`).join(",")}`,
      );
  }
}

/** Whose problem this is. Deterministic in the problem itself. */
export function castFor(request: FramingRequest): Character {
  const cast = THEME_CAST[request.theme];
  const rng = createRng(seedFor(request));
  return rng.pick(cast.characters);
}
