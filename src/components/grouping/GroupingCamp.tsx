"use client";

import { useReducer } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AnswerBurst } from "@/components/effects/AnswerBurst";
import { Celebration } from "@/components/effects/Celebration";
import type { CampDefinition, GroupingFocus, Mastery } from "@/lib/domain/camp";
import { mechanicLabel } from "@/lib/domain/camp";
import type { GroupingTask, PlaceCounts, PlaceUnit } from "@/lib/domain/grouping";
import { GROUPING_BAND_RANGES, PLACE_LABEL, groupingSkillPhrase, overfullPlace } from "@/lib/domain/grouping";
import type {
  GroupingAction,
  GroupingHint,
  GroupingSession,
} from "@/lib/domain/groupingSession";
import { reduceGroupingSession, startGroupingSession } from "@/lib/domain/groupingSession";
import { isCampComplete } from "@/lib/domain/mastery";
import { YAY, groupingMiss, type Reaction } from "@/lib/domain/reaction";
import type { LearnerProgress } from "@/lib/domain/progress";
import type { ClimbContext } from "@/lib/domain/milestones";
import { SessionSummary } from "@/components/summary/SessionSummary";
import type { ClimberProfile } from "@/lib/domain/onboarding";
import { useEncouragement, useWordProblem } from "@/lib/ai/useCoach";
import { spokenGrouping } from "@/lib/ai/spokenProblem";
import { ReadAloudButton } from "@/components/ReadAloudButton";
import { expectedBlocks } from "@/lib/math/groupingTasks";
import { INTEREST_PALETTES } from "@/lib/theme/interestTheme";
import { answerOutcome, useCampSitting } from "@/lib/progress/useCampSitting";
import { ladderStart } from "@/lib/math/sequence";
import { ProblemFraming } from "@/components/ProblemFraming";
import { GroupingBoard } from "@/components/grouping/GroupingBoard";
import { AppBar } from "@/components/AppBar";
import { PageShell } from "@/components/PageShell";
import { CampHeader } from "@/components/CampHeader";
import { CampMasteredBanner } from "@/components/CampMasteredBanner";

function placeName(unit: PlaceUnit): string {
  return PLACE_LABEL[unit].toLowerCase();
}

/**
 * Names the place to trade up. Any non-canonical mat holding the right total
 * has at least ten blocks in some place below the top, which is what to say.
 */
function regroupMessage(target: number, counts: PlaceCounts, units: readonly PlaceUnit[]): string {
  const trade = overfullPlace(counts, units);
  if (trade === null) {
    return `That is ${String(target)}. Now trade up so each place holds fewer than ten.`;
  }
  return `That is ${String(target)} — nice. Now trade: ten ${placeName(trade.from)} make one of the ${placeName(trade.to)}.`;
}

function hintMessage(task: GroupingTask, counts: PlaceCounts, hint: GroupingHint): string {
  switch (hint) {
    case "wrong-strip":
      return task.kind === "array"
        ? `That row is a different length. This array is built from rows of ${String(task.cols)}.`
        : "";
    case "uneven-rows":
      return "Every row in an array is the same length. Tap a row to take it off.";
    case "too-many":
      return task.kind === "array"
        ? `That is more than ${String(task.rows)} rows. Tap a row to take one off.`
        : "";
    case "over-target":
      return task.kind === "place-value"
        ? `That is more than ${String(task.target)}. Tap a block to take it off.`
        : "";
    case "needs-regroup":
      return task.kind === "place-value"
        ? regroupMessage(task.target, counts, task.unitChoices)
        : "";
  }
}

/** "3 hundreds + 4 tens + 7 ones", skipping the empty places. */
function placeBreakdown(task: Extract<GroupingTask, { kind: "place-value" }>): string {
  const topUnit = task.unitChoices[0];
  return task.unitChoices
    .map((unit) => ({ unit, digit: expectedBlocks(task.target, unit, topUnit) }))
    .filter(({ digit }) => digit > 0)
    .map(({ unit, digit }) => `${String(digit)} ${placeName(unit)}`)
    .join(" + ");
}

/** The encouraging line that follows a correct build. */
function successNote(task: GroupingTask, note: "clean" | "commuted" | "after-retry"): string {
  if (note === "commuted" && task.kind === "array") {
    return `${String(task.cols)} rows of ${String(task.rows)} makes the same array — good thinking.`;
  }
  if (note === "clean") return "Built it first time. Nice work!";
  return "You worked it out — well climbed.";
}

interface GroupingCampProps {
  readonly camp: CampDefinition;
  readonly focus: GroupingFocus;
  readonly profile: ClimberProfile;
  /** This camp's saved Mastery Meter, loaded on the server. */
  readonly startingMastery: Mastery;
  /** The learner's whole record as it stood when this screen loaded. */
  readonly progressAtStart: LearnerProgress;
  /** The climb log, for streaks and personal bests on the summary. */
  readonly climb: ClimbContext;
}

export function GroupingCamp({
  camp,
  focus,
  profile,
  startingMastery,
  progressAtStart,
  climb,
}: GroupingCampProps) {
  const [state, dispatch] = useReducer(
    (current: GroupingSession, action: GroupingAction) =>
      reduceGroupingSession(current, action, focus, profile.gradeBand),
    { focus, band: profile.gradeBand, startingMastery },
    ({ focus: f, band, startingMastery: seed }) =>
      startGroupingSession(f, band, seed, Date.now(), ladderStart(progressAtStart.totalSolves)),
  );

  const reaction: Reaction | null =
    state.round.kind === "right"
      ? YAY
      : state.round.kind === "issue"
        ? groupingMiss(state.round.hint)
        : null;
  const palette = INTEREST_PALETTES[profile.interestTheme];
  const ranges = GROUPING_BAND_RANGES[profile.gradeBand];
  const { task, round, workspace } = state;
  const solvedNow = round.kind === "right";
  const counts: PlaceCounts =
    workspace.kind === "place-value" ? workspace.counts : { 1000: 0, 100: 0, 10: 0, 1: 0 };

  // Writing solves through, the child's own day, the read-aloud decision, the
  // reaction key and the end-of-sitting summary are all the same on every camp
  // screen, so they live in one hook rather than in each.
  const sitting = useCampSitting({
    camp: camp.number,
    campName: camp.name,
    skill: groupingSkillPhrase(focus),
    profile,
    progressAtStart,
    climb,
    tally: state,
  });

  // The words come from the coach; every number in them is one we supplied.
  const framing = useWordProblem(
    task.kind === "array"
      ? { kind: "array", theme: profile.interestTheme, rows: task.rows, cols: task.cols }
      : { kind: "place-value", theme: profile.interestTheme, target: task.target },
  );
  const coachLine = useEncouragement(
    round.kind === "building"
      ? null
      : {
          theme: profile.interestTheme,
          outcome: answerOutcome(round.kind === "right", state.wrongAttempts),
          ...(round.kind === "issue"
            ? { hint: hintMessage(task, counts, round.hint) }
            : {}),
        },
  );



  if (sitting.summary !== null) return <SessionSummary {...sitting.summary} />;

  return (
    <>
      <AppBar current="none" />
      <PageShell>
        <CampHeader
          camp={camp}
          palette={palette}
          title={mechanicLabel(camp.mechanic)}
          subtitle={focus === "array" ? ranges.array.description : ranges.placeValue.description}
          mastery={state.mastery}
          onFinish={sitting.finish}
        />

        <section className="rounded-[28px] border-2 border-edge bg-surface p-5 shadow-sm sm:p-6">
          {/* From `lg` the words sit beside the board rather than above it, so a
              laptop sees the whole problem without scrolling. */}
          <div className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-center lg:gap-8">
          <div className="mb-5 text-center lg:mb-0 lg:text-left">
            <p className="text-sm text-ink-soft">
              Task {task.index + 1} · {state.solved} built
            </p>
            {/* The two families differ only in the sum they show and the sentence
                that follows it; everything between was the same markup twice. */}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
              <p className="text-5xl font-extrabold tabular-nums tracking-tight text-ink sm:text-6xl">
                {task.kind === "array" ? (
                  <>
                    {task.rows} × {task.cols} ={" "}
                    {solvedNow ? (
                      <span className="text-reward-ink">{task.rows * task.cols}</span>
                    ) : (
                      <span className="text-brand">?</span>
                    )}
                  </>
                ) : (
                  task.target
                )}
              </p>
              {sitting.readAloud && <ReadAloudButton text={spokenGrouping(task, framing)} />}
            </div>
            <ProblemFraming framing={framing} theme={profile.interestTheme} />
            <p className="mt-2 text-sm text-ink-soft">
              {task.kind === "array" ? (
                <>
                  Build <span className="font-semibold text-ink">{task.rows} rows</span> of{" "}
                  <span className="font-semibold text-ink">{task.cols}</span>. Drag the rows into
                  the frame.
                </>
              ) : (
                <>
                  Make <span className="font-semibold text-ink">{task.target}</span> with blocks.
                  Drag them onto the mat.
                </>
              )}
            </p>
          </div>

          <div className="relative">
            {reaction !== null && <AnswerBurst reaction={reaction} fireKey={sitting.burstKey} />}
          <GroupingBoard
            task={task}
            workspace={workspace}
            palette={palette}
            locked={solvedNow}
            dispatch={dispatch}
          />
          </div>
          </div>

          {/* Feedback */}
          <div className="mt-5" aria-live="polite">
            <AnimatePresence mode="wait">
              {round.kind === "issue" && (
                <motion.div
                  key={`issue-${round.hint}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="relative flex flex-col items-center gap-3 overflow-visible rounded-2xl border-2 border-info bg-info/15 p-4 text-center"
                >
                  <p className="text-sm font-medium text-ink">
                    {hintMessage(task, counts, round.hint)}
                  </p>
                  <button
                    type="button"
                    onClick={() => { dispatch({ type: "clear" }); }}
                    className="inline-flex min-h-11 items-center rounded-full border border-edge px-5 text-xs font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    Start this one over
                  </button>
                </motion.div>
              )}

              {round.kind === "right" && (
                <motion.div
                  key={`right-${String(task.index)}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="relative flex flex-col items-center gap-3 overflow-visible rounded-2xl border-2 border-reward bg-reward-soft p-4 text-center"
                >
                  <Celebration variant="burst" fireKey={state.solved} />
                  <p className="text-base font-bold text-reward-ink">
                    {task.kind === "array"
                      ? `${String(task.rows)} × ${String(task.cols)} = ${String(task.rows * task.cols)}`
                      : `${String(task.target)} = ${placeBreakdown(task)}`}{" "}
                    · +{round.gained} mastery
                  </p>
                  <p className="text-sm text-ink-soft">
                    {coachLine?.line ?? successNote(task, round.note)}
                  </p>
                  {!isCampComplete(state.mastery) && (
                    <button
                      type="button"
                      onClick={() => { dispatch({ type: "next", now: Date.now() }); }}
                      className="inline-flex min-h-11 items-center rounded-full bg-gradient-to-r from-brand to-brand-deep px-6 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      Next one
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        <Celebration
          variant="rain"
          fireKey={isCampComplete(state.mastery) && state.solved > 0 ? 1 : 0}
        />

        <CampMasteredBanner
          camp={camp.number}
          complete={isCampComplete(state.mastery)}
          glyph={camp.number === 4 ? "🏔️" : "🏕️"}
          verb="building"
          onKeepPractising={() => { dispatch({ type: "next", now: Date.now() }); }}
        />
      </PageShell>
    </>
  );
}
