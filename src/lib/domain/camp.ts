import { z } from "zod";

/** The two task families the grouping mechanic covers. */
export type GroupingFocus = "array" | "place-value";

/**
 * The two skills the number-line mechanic covers. `within-place` keeps a jump
 * inside one ten (or hundred); `cross-place` forces it over the boundary,
 * which is the harder and more important skill.
 */
export type JumpSkill = "within-place" | "cross-place";

/**
 * What a camp asks the child to *do*. Each camp sets a different one, so that
 * climbing the mountain is not the same act four times with bigger numbers.
 *
 * This was capped at two for a long time, on the reasoning that two bounded
 * the motor skills a child had to learn. What it bounded in practice was the
 * variety: camps 1 and 2 were one number line apart only in whether the jump
 * carried, and camps 3 and 4 were both "drag pieces into a frame". Testers
 * read the second of each pair as a repeat of the first.
 */
export type Mechanic =
  | { readonly kind: "number-line-jump"; readonly skill: JumpSkill }
  | { readonly kind: "array-grouping"; readonly focus: GroupingFocus }
  /** Read a jump and choose the landing, rather than walking to it. */
  | { readonly kind: "pick-the-jump"; readonly skill: JumpSkill }
  /** Tidy a number that is already on the mat by trading ten for one. */
  | { readonly kind: "trade-up" };

/** The mountain has exactly 4 camps, numbered from the trailhead up. */
export type CampNumber = 1 | 2 | 3 | 4;

/**
 * A camp that does not exist yet, shown on the map so a child knows what is
 * coming. Deliberately not a `CampDefinition` and not a `CampNumber`: it has
 * no mechanic, no route, no meter and no lock, and nothing but the map may
 * ever see it. The mountain has exactly four camps.
 */
export interface UpcomingCamp {
  readonly number: 5 | 6;
  readonly name: string;
  readonly skill: string;
  readonly marker: CampMarkerPosition;
}

/**
 * Literals rather than a numeric range, so a parsed value is a `CampNumber`
 * and the "exactly 4 camps" rule is enforced by the type system too.
 */
export const campNumberSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

/** Mastery Meter reading, 0-100. */
export type Mastery = number;

/**
 * Where a camp stands for this climber. A discriminated union so that a locked
 * camp can never carry a mastery reading, and a checkpoint can never be
 * missing the camp it wants reviewed.
 */
export type CampProgress =
  | {
      readonly status: "open";
      /** The meter as shown, after any decay. */
      readonly mastery: Mastery;
      /** What was actually earned here — the meter before decay dimmed it. */
      readonly earned: Mastery;
    }
  | { readonly status: "locked"; readonly unlocksAfter: CampNumber }
  | {
      readonly status: "checkpoint";
      readonly mastery: Mastery;
      readonly earned: Mastery;
      /** The dimmed camp that must be reviewed before climbing this one. */
      readonly reviewOf: CampNumber;
    };

/** What a camp *is* — fixed, and the same for every climber. */
/** Where a camp sits on the mountain board, as a percentage of each axis. */
export interface CampMarkerPosition {
  readonly xPercent: number;
  readonly yPercent: number;
}

export interface CampDefinition {
  readonly number: CampNumber;
  readonly name: string;
  readonly skill: string;
  readonly mechanic: Mechanic;
  /** Position on the mountain path, as percentages of the map viewport. */
  readonly marker: CampMarkerPosition;
}

/** A camp definition plus where this climber stands in it. */
export interface Camp extends CampDefinition {
  readonly progress: CampProgress;
}

/** Every camp, low to high. There are exactly four, and only ever four. */
export const CAMP_NUMBERS: readonly [CampNumber, CampNumber, CampNumber, CampNumber] = [
  1, 2, 3, 4,
];

/** The camp below a given one, or null at the trailhead. */
export const PREVIOUS_CAMP: Record<CampNumber, CampNumber | null> = {
  1: null,
  2: 1,
  3: 2,
  4: 3,
};

export function mechanicLabel(mechanic: Mechanic): string {
  switch (mechanic.kind) {
    case "number-line-jump":
      return mechanic.skill === "within-place" ? "Number-line jump" : "Bridging jump";
    case "array-grouping":
      return mechanic.focus === "array" ? "Array building" : "Place-value grouping";
    case "pick-the-jump":
      return "Pick the landing";
    case "trade-up":
      return "Name the number";
  }
}
