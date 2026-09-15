import type { CampDefinition, UpcomingCamp } from "@/lib/domain/camp";

/**
 * What the four camps are. Lock state is not here: it is derived from the
 * climber's Mastery Meters, so finishing a camp opens the next one.
 */
export const CAMP_DEFINITIONS: readonly [
  CampDefinition,
  CampDefinition,
  CampDefinition,
  CampDefinition,
] = [
  {
    number: 1,
    name: "Trailhead",
    skill: "Add and subtract in small steps",
    mechanic: { kind: "number-line-jump", skill: "within-place" },
    marker: { xPercent: 18, yPercent: 84 },
  },
  {
    number: 2,
    name: "Pine Ridge",
    skill: "Spot where a crossing jump lands",
    mechanic: { kind: "pick-the-jump", skill: "cross-place" },
    marker: { xPercent: 40, yPercent: 62 },
  },
  {
    number: 3,
    name: "Glacier Field",
    skill: "Build arrays to multiply",
    mechanic: { kind: "array-grouping", focus: "array" },
    marker: { xPercent: 62, yPercent: 40 },
  },
  {
    number: 4,
    name: "The Summit",
    skill: "Read tens, hundreds and thousands as one number",
    mechanic: { kind: "trade-up" },
    marker: { xPercent: 81, yPercent: 17 },
  },
];

/**
 * The next range, seen from the summit: two camps that are *coming soon*.
 *
 * Teasers only. They are drawn on the map so a child knows the climb goes on,
 * and nowhere else: no route, no reducer, no meter, no unlock — `CampNumber`
 * still stops at 4 and `campsWithProgress` never sees them. They stand on the
 * next range, to the right of the summit, which the board scrolls to. Their
 * markers are percentages of that **extension area** (`extensionArea`), not of
 * the mountain, so the four camps never move; the backdrop's continued face
 * peaks under each one (`1130,345` and `1343,175` in its viewBox), and
 * `mapLayout.test.ts` proves the cards stay on the board and clear of every
 * camp card. The names and skills are placeholders for the product to confirm.
 */
export const UPCOMING_CAMPS: readonly [UpcomingCamp, UpcomingCamp] = [
  {
    number: 5,
    name: "Cloud Peak",
    skill: "Share things out into equal groups",
    marker: { xPercent: 25, yPercent: 55.2 },
  },
  {
    number: 6,
    name: "Star Ridge",
    skill: "Split one whole into fraction pieces",
    marker: { xPercent: 66, yPercent: 28 },
  },
];
