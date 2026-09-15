import type { JumpSkill } from "@/lib/domain/camp";
import type { GradeBand } from "@/lib/domain/onboarding";

export type JumpOperation = "add" | "subtract";

/**
 * One number-line jump. The child starts on `start` and must land on `answer`
 * by jumping `change` in the direction the operation implies.
 */
export interface JumpProblem {
  readonly index: number;
  readonly operation: JumpOperation;
  readonly start: number;
  readonly change: number;
  readonly answer: number;
  /** The window of the number line to draw, inclusive. Always unit ticks. */
  readonly line: { readonly min: number; readonly max: number };
}

/**
 * Grade-appropriate ranges. Every band jumps on a unit-tick line — higher
 * bands work with bigger anchor numbers rather than bigger jumps, which keeps
 * the line countable while the place value grows.
 */
export interface BandRange {
  /** Largest number that can appear. */
  readonly ceiling: number;
  /** The place a jump either stays inside or crosses: a ten, or a hundred. */
  readonly unit: number;
  /** Jump size bounds, before difficulty narrows them. */
  readonly minChange: number;
  readonly maxChange: number;
  /** Fixed line window, when the band should always see the same line. */
  readonly fixedLine: { readonly min: number; readonly max: number } | null;
}

export const BAND_RANGES: Record<GradeBand, BandRange> = {
  "k-1": {
    ceiling: 20,
    unit: 10,
    minChange: 1,
    maxChange: 9,
    fixedLine: { min: 0, max: 20 },
  },
  "2-3": {
    ceiling: 100,
    unit: 10,
    // Floors rise with the band: level 1 must not hand a third-year child
    // K-1's easiest jump. The bands still overlap a little, so a child who is
    // genuinely behind can reach gentle work.
    minChange: 3,
    maxChange: 19,
    fixedLine: null,
  },
  "4-5": {
    ceiling: 1000,
    unit: 100,
    minChange: 6,
    maxChange: 20,
    fixedLine: null,
  },
};

/**
 * What the camp is practising, in words.
 *
 * K-1 works in one ten, so "inside a ten" and "bridging a ten" describe
 * exactly what the child sees. Above that the skill is regrouping — `29 - 17`
 * stays free of carrying while travelling across two tens — so "inside a ten"
 * would simply be false, and the bands get the vocabulary their classrooms
 * use instead.
 */
function jumpWords(skill: JumpSkill, band: GradeBand): string {
  if (band === "k-1") {
    return skill === "within-place" ? "jumps inside a ten" : "jumps that bridge a ten";
  }
  return skill === "within-place" ? "jumps with no carrying" : "jumps that carry over";
}

/** What the camp header says it is practising, for this skill and band. */
export function jumpSkillDescription(skill: JumpSkill, band: GradeBand): string {
  const { ceiling } = BAND_RANGES[band];
  const words = jumpWords(skill, band);
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}, up to ${String(ceiling)}`;
}

/**
 * The same skill as a fragment that reads inside a sentence. The header label
 * ("Jumps inside a ten, up to 20") is not a phrase you can drop into prose.
 */
export function jumpSkillPhrase(skill: JumpSkill, band: GradeBand): string {
  return jumpWords(skill, band);
}
