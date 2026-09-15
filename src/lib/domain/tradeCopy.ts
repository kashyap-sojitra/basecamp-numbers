import { PLACE_LABEL, type PlaceCounts, type PlaceUnit } from "@/lib/domain/grouping";
import type { GradeBand } from "@/lib/domain/onboarding";
import type { TradeSlip } from "@/lib/domain/tradeDiagnosis";

/**
 * Every word camp 4 says to the child, in one place.
 *
 * The mat shows a number **the long way** — `7 tens and 14 ones` — and the
 * child works out what it is worth and types it. The reading of the mat is
 * always spelled out in words, because that is the question; the value is
 * never written anywhere until the child has found it, because that is the
 * answer. When they have, the mat is read back as a sum — `7 tens and 14 ones
 * = 84` — which is the whole lesson in one line.
 *
 * K-1 gets the plainest form of each line and never meets "the long way":
 * a metaphor is a translation a five-year-old has no spare attention for.
 * Every hint is digit-free by construction, since it is what the coach is
 * handed and the model must never be given a number.
 */

/** The place as a word, for a sentence: "tens", "ones". */
export function placeName(unit: PlaceUnit): string {
  return PLACE_LABEL[unit].toLowerCase();
}

/** One place, counted: "1 ten", "14 ones", "0 hundreds". */
function countOf(unit: PlaceUnit, held: number): string {
  const word = placeName(unit);
  return `${String(held)} ${held === 1 ? word.slice(0, -1) : word}`;
}

/**
 * What the mat holds, read left to right: "2 thousands, 3 hundreds, 1 ten and
 * 5 ones". Every place in play is named, empty ones included, so the words
 * match the columns one for one.
 */
export function placeReading(counts: PlaceCounts, units: readonly PlaceUnit[]): string {
  const parts = units.map((unit) => countOf(unit, counts[unit]));
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1] ?? ""}`;
}

/** The line under the camp's title. */
export function tradeSubtitle(band: GradeBand): string {
  return band === "k-1"
    ? "Count the tens and the ones"
    : "Read tens, hundreds and thousands as one number";
}

/** The question. */
export function tradeQuestion(band: GradeBand): string {
  return band === "k-1" ? "What number is on the mat?" : "What number is this?";
}

/** How to answer it, under the question. */
export function tradeInstruction(band: GradeBand): string {
  return band === "k-1"
    ? "Ten ones make one ten. Count them up, then type the number."
    : "The mat shows a number the long way. Work out what it is worth and type it.";
}

/**
 * The mat read back as a sum once the number is found: "7 tens and 14 ones
 * = 84". The shape on the left, the value on the right.
 */
export function matReading(
  band: GradeBand,
  counts: PlaceCounts,
  units: readonly PlaceUnit[],
  value: number,
): string {
  const reading = placeReading(counts, units);
  return band === "k-1"
    ? `${reading} make ${String(value)}`
    : `${reading} = ${String(value)}`;
}

/**
 * What to say about a wrong number: the specific slip, in words a child can
 * act on, with no digit in it. Handed to the coach as the diagnosis.
 */
export function tradeHint(band: GradeBand, slip: TradeSlip): string {
  const young = band === "k-1";
  switch (slip) {
    case "places-side-by-side":
      return young
        ? "Not side by side. A ten is worth ten ones. Add them up."
        : "Those are the counts, not the digits. Each place is worth its count times its size — add the places up.";
    case "forgot-to-carry":
      return young
        ? "Look at the ringed ten. Ten ones make one more ten."
        : "Every ringed ten is one more of the next place up. Carry it over.";
    case "off-by-one":
      return young ? "So close. Count the ones again." : "One away. Count the ones once more.";
    case "one-place-only":
      return young
        ? "That is just one pile. Add the tens and the ones together."
        : "That is one place on its own. Add every place together.";
    case "miscounted":
      return young
        ? "Count each pile again, then add them up."
        : "Count each place again, then add them all up.";
  }
}

/** The read-aloud version of the task: the story first, if there is one. */
export function spokenTradeTask(
  units: readonly PlaceUnit[],
  start: PlaceCounts,
  story: string | null,
): string {
  const lead = story === null ? "" : `${story} `;
  return `${lead}The mat shows ${placeReading(start, units)}. What number is that? Type it in.`;
}
