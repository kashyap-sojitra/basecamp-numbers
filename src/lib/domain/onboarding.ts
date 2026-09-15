import { z } from "zod";

/** The three grade bands the child can be placed in. */
export const gradeBandSchema = z.enum(["k-1", "2-3", "4-5"]);
export type GradeBand = z.infer<typeof gradeBandSchema>;

/** The interest theme that colors the game pieces inside the dark frame. */
export const interestThemeSchema = z.enum(["space", "ocean", "jungle"]);
export type InterestTheme = z.infer<typeof interestThemeSchema>;

/** A completed onboarding choice — both picks made. */
export const climberProfileSchema = z.object({
  gradeBand: gradeBandSchema,
  interestTheme: interestThemeSchema,
});
export type ClimberProfile = z.infer<typeof climberProfileSchema>;

/**
 * Whether this climber gets the read-aloud button beside the problem.
 *
 * K-1 only: for a five-to-seven-year-old the barrier is decoding the words,
 * not the arithmetic. One predicate rather than `gradeBand === "k-1"` repeated
 * at each call site, so the band that gets it is decided in exactly one place.
 */
export function wantsReadAloud(profile: ClimberProfile): boolean {
  return profile.gradeBand === "k-1";
}

interface GradeBandOption {
  readonly value: GradeBand;
  /**
   * What the child reads first, in the first person. "K-1" is a US school
   * label a five-year-old cannot decode, and this is the very first thing the
   * app asks them — so the grade is kept, but demoted to the line the adult
   * looking over their shoulder reads.
   */
  readonly stage: string;
  readonly ages: string;
  /** The school grade, still shown, and what the map's chip says. */
  readonly grade: string;
  readonly blurb: string;
  /** Decoration, and a foothold for a child who cannot read the words yet. */
  readonly glyph: string;
}

export const GRADE_BAND_OPTIONS: readonly GradeBandOption[] = [
  {
    value: "k-1",
    stage: "I'm just starting",
    ages: "Ages 5–7",
    grade: "K–1",
    blurb: "Counting, and little jumps up to 20",
    glyph: "🌱",
  },
  {
    value: "2-3",
    stage: "I'm getting good",
    ages: "Ages 7–9",
    grade: "2–3",
    blurb: "Bigger jumps to 100, and rows to multiply",
    glyph: "🧭",
  },
  {
    value: "4-5",
    stage: "I'm ready for big numbers",
    ages: "Ages 9–11",
    grade: "4–5",
    blurb: "Hundreds, thousands, and times tables",
    glyph: "🏔️",
  },
];

interface InterestThemeOption {
  readonly value: InterestTheme;
  readonly label: string;
  readonly blurb: string;
  readonly glyph: string;
}

export const INTEREST_THEME_OPTIONS: readonly InterestThemeOption[] = [
  { value: "space", label: "Space", blurb: "Rockets, planets, stars", glyph: "🚀" },
  { value: "ocean", label: "Ocean", blurb: "Waves, whales, coral", glyph: "🐋" },
  { value: "jungle", label: "Jungle", blurb: "Vines, tigers, toucans", glyph: "🐯" },
];
