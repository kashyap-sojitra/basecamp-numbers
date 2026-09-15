/**
 * Adaptive difficulty. Every camp runs at a level from 1 to 5, and the level
 * moves after each answer. The whole rule is `nextDifficulty` below — that is
 * the only place difficulty is decided.
 */

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

/** Low to high. The single source of the ladder's shape. */
export const DIFFICULTY_LEVELS: readonly [DifficultyLevel, ...DifficultyLevel[]] = [1, 2, 3, 4, 5];

/** New camps open a little below the middle, so the first answer feels good. */
export const STARTING_DIFFICULTY: DifficultyLevel = 2;

/**
 * How long an answer may take and still count as quick. Harder problems get
 * more time, so a child is not pushed down for thinking about a big jump.
 */
export function quickThresholdMs(level: DifficultyLevel): number {
  return 5_000 + level * 2_000;
}

/** Past this, an answer counts as a struggle even when it is right. */
const SLOW_MULTIPLE = 2.5;

/** One answer, as the rule sees it. */
export interface AnswerOutcome {
  readonly correct: boolean;
  /** Milliseconds from the problem appearing to the child resolving it. */
  readonly elapsedMs: number;
}

export type DifficultyMove = "up" | "hold" | "down";

/**
 * THE ADAPTIVE DIFFICULTY RULE.
 *
 * Given the level a problem was set at and how the child answered it, decide
 * the level for the next problem:
 *
 *   - wrong                  -> down one   (ease off, whatever the clock said)
 *   - right and quick        -> up one     (this level is comfortable)
 *   - right but slow         -> down one   (right, but it was a struggle)
 *   - right, neither         -> hold       (about right, stay here)
 *
 * Difficulty only ever changes what the next problem looks like. It never
 * costs mastery and is never shown to the child, so moving down is a quiet
 * adjustment rather than a demotion.
 */
export function difficultyMove(level: DifficultyLevel, outcome: AnswerOutcome): DifficultyMove {
  const quick = quickThresholdMs(level);
  if (!outcome.correct) return "down";
  if (outcome.elapsedMs <= quick) return "up";
  if (outcome.elapsedMs >= quick * SLOW_MULTIPLE) return "down";
  return "hold";
}

/** Applies the rule, clamped to the ends of the ladder. */
export function nextDifficulty(
  level: DifficultyLevel,
  outcome: AnswerOutcome,
): DifficultyLevel {
  const move = difficultyMove(level, outcome);
  const step = move === "up" ? 1 : move === "down" ? -1 : 0;
  const index = DIFFICULTY_LEVELS.indexOf(level) + step;
  const clamped = Math.max(0, Math.min(DIFFICULTY_LEVELS.length - 1, index));
  // The ladder is a non-empty tuple and the index is clamped inside it.
  return DIFFICULTY_LEVELS[clamped] ?? level;
}

/**
 * The slice of a `min..max` range a level draws from, so one difficulty knob
 * can scale any of the generators' ranges. Level 1 takes the easiest slice,
 * level 5 reaches the top of the range.
 */
export function levelBand(
  min: number,
  max: number,
  level: DifficultyLevel,
): { readonly lo: number; readonly hi: number } {
  if (max <= min) return { lo: min, hi: min };
  const span = max - min;
  const levels = DIFFICULTY_LEVELS.length;
  const lo = min + Math.floor((span * (level - 1)) / levels);
  const hi = min + Math.max(1, Math.ceil((span * level) / levels));
  return { lo, hi: Math.min(max, Math.max(lo, hi)) };
}
