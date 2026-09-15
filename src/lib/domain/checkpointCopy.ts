import type { CampNumber } from "@/lib/domain/camp";
import { CHECKPOINT_QUESTIONS } from "@/lib/domain/decay";
import type { GradeBand } from "@/lib/domain/onboarding";

/**
 * How a dimmed camp is described to the child.
 *
 * A metaphor asks the reader to translate before they can act, and a
 * five-year-old is spending everything they have on decoding the letters. So
 * K-1 gets concrete words — a warm-up, something you do — while the older
 * bands keep the dimming language the meter itself shows.
 */

export interface CheckpointCopy {
  /** The flag on a camp card. */
  readonly chip: string;
  /** The banner's eyebrow, above the headline. */
  readonly eyebrow: string;
  /** The banner's headline. */
  readonly headline: (camp: CampNumber) => string;
  /** The banner's supporting line. */
  readonly detail: (earned: number, shown: number, stale: number) => string;
  /** The one-liner on the camp's own card. */
  readonly card: (camp: CampNumber) => string;
  /**
   * The line on a *higher* camp that the dimmed one gates: which camp to see
   * to first. Words only — a camp's card never offers another camp's review,
   * since the child would read the question as this camp's.
   */
  readonly gate: (camp: CampNumber) => string;
  /** The line at the foot of the map. */
  readonly foot: (camp: CampNumber) => string;
  /** The button that starts the review. */
  readonly action: string;
  /** The same button, on a card too narrow for a sentence. */
  readonly chipAction: string;
  /** The review screen's own eyebrow and subtitle. */
  readonly reviewEyebrow: string;
  readonly reviewSubtitle: string;
  /** What the review screen says once it is passed. */
  readonly done: (camp: CampNumber) => string;
}

/**
 * K-1. Concrete and physical: a warm-up is a thing you do before you play,
 * which a five-year-old already knows. No meter, no checkpoint, no dimming,
 * and one number rather than three.
 */
const YOUNGEST: CheckpointCopy = {
  chip: "Warm-up",
  eyebrow: "Warm-up time",
  headline: (camp) => `Camp ${String(camp)} needs a warm-up!`,
  detail: () =>
    `You have been climbing up high. Answer ${String(CHECKPOINT_QUESTIONS)} questions to fill it back up.`,
  card: (camp) => `Camp ${String(camp)} needs a warm-up first.`,
  gate: (camp) => `Warm up Camp ${String(camp)} first`,
  foot: (camp) => `Warm up Camp ${String(camp)} before you climb higher.`,
  action: "Start warm-up",
  chipAction: "Warm up",
  reviewEyebrow: "Warm-up",
  reviewSubtitle: `${String(CHECKPOINT_QUESTIONS)} quick questions to fill this camp back up.`,
  done: (camp) => `Camp ${String(camp)} is full again!`,
};

/** 2-3 and 4-5, who can carry the metaphor the meter is already showing. */
const OLDER: CheckpointCopy = {
  chip: "Gone dim",
  eyebrow: "Checkpoint needed",
  headline: (camp) => `Camp ${String(camp)} has gone dim while you climbed elsewhere.`,
  detail: (earned, shown, stale) =>
    `Its meter slipped from ${String(earned)} to ${String(shown)} over ${String(stale)} problems away. Answer ${String(CHECKPOINT_QUESTIONS)} questions to bring it all the way back.`,
  card: (camp) => `Camp ${String(camp)} has gone dim — review it to climb on.`,
  gate: (camp) => `Review Camp ${String(camp)} first`,
  foot: (camp) => `Camp ${String(camp)} needs a checkpoint before you can climb higher.`,
  action: "Start checkpoint",
  chipAction: "Checkpoint",
  reviewEyebrow: "Checkpoint",
  reviewSubtitle: `${String(CHECKPOINT_QUESTIONS)} quick questions to bring this camp back up.`,
  done: (camp) => `Camp ${String(camp)} is bright again!`,
};

/** The words for this climber's band. */
export function checkpointCopy(band: GradeBand): CheckpointCopy {
  return band === "k-1" ? YOUNGEST : OLDER;
}
