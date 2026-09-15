"use client";

import { useReducer } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AnswerBurst } from "@/components/effects/AnswerBurst";
import { Celebration } from "@/components/effects/Celebration";
import type { CampDefinition, JumpSkill, Mastery } from "@/lib/domain/camp";
import { mechanicLabel } from "@/lib/domain/camp";
import {
  reduceSession,
  startSession,
  type CampSession,
  type CampSessionAction,
} from "@/lib/domain/campSession";
import { diagnoseJump } from "@/lib/domain/jumpDiagnosis";
import { YAY, jumpMiss, type Reaction } from "@/lib/domain/reaction";
import { isCampComplete } from "@/lib/domain/mastery";
import { jumpSkillDescription } from "@/lib/domain/numberLine";
import type { LearnerProgress } from "@/lib/domain/progress";
import type { ClimbContext } from "@/lib/domain/milestones";
import type { ClimberProfile } from "@/lib/domain/onboarding";
import { SessionSummary } from "@/components/summary/SessionSummary";
import { useEncouragement, useWordProblem } from "@/lib/ai/useCoach";
import type { FramingRequest } from "@/lib/ai/types";
import { spokenJump } from "@/lib/ai/spokenProblem";
import { ReadAloudButton } from "@/components/ReadAloudButton";
import { INTEREST_PALETTES } from "@/lib/theme/interestTheme";
import { answerOutcome, useCampSitting } from "@/lib/progress/useCampSitting";
import { ladderStart } from "@/lib/math/sequence";
import { jumpChoices } from "@/lib/math/jumpChoices";
import { ProblemFraming } from "@/components/ProblemFraming";
import { AppBar } from "@/components/AppBar";
import { PageShell } from "@/components/PageShell";
import { CampHeader } from "@/components/CampHeader";
import { CampMasteredBanner } from "@/components/CampMasteredBanner";

interface PickTheJumpCampProps {
  readonly camp: CampDefinition;
  readonly skill: JumpSkill;
  readonly profile: ClimberProfile;
  readonly startingMastery: Mastery;
  readonly progressAtStart: LearnerProgress;
  readonly climb: ClimbContext;
}

/**
 * Camp 2: the same crossing jump as the number line, answered by choosing a
 * landing rather than walking to one.
 *
 * It shares `campSession` with camp 1 on purpose — a chosen landing *is* a
 * landing, so the reducer, the diagnosis and the coach all work unchanged, and
 * the difficulty ladder is camp 2's existing one. What differs is the act:
 * reading four landings and judging which is right, rather than counting along
 * a line. See `jumpChoices` for why the three wrong ones are not noise.
 */
export function PickTheJumpCamp({
  camp,
  skill,
  profile,
  startingMastery,
  progressAtStart,
  climb,
}: PickTheJumpCampProps) {
  const [state, dispatch] = useReducer(
    (current: CampSession, action: CampSessionAction) =>
      reduceSession(current, action, skill, profile.gradeBand),
    { skill, band: profile.gradeBand, startingMastery },
    ({ skill: s, band, startingMastery: seed }) =>
      startSession(s, band, seed, Date.now(), ladderStart(progressAtStart.totalSolves)),
  );

  const { problem, round } = state;
  const palette = INTEREST_PALETTES[profile.interestTheme];
  const choices = jumpChoices(problem, profile.gradeBand);
  const solvedNow = round.kind === "right";
  const reaction: Reaction | null =
    round.kind === "right" ? YAY : round.kind === "wrong" ? jumpMiss(problem, round.landed) : null;

  const sitting = useCampSitting({
    camp: camp.number,
    campName: camp.name,
    skill: jumpSkillDescription(skill, profile.gradeBand),
    profile,
    progressAtStart,
    climb,
    tally: state,
  });

  const framingRequest: FramingRequest = {
    kind: "jump",
    theme: profile.interestTheme,
    operation: problem.operation,
    start: problem.start,
    change: problem.change,
  };
  const framing = useWordProblem(framingRequest);
  const coachLine = useEncouragement(
    round.kind === "awaiting"
      ? null
      : {
          theme: profile.interestTheme,
          outcome: answerOutcome(round.kind === "right", state.wrongAttempts),
          ...(round.kind === "wrong"
            ? { hint: diagnoseJump(problem, round.landed).nudge }
            : {}),
        },
  );

  if (sitting.summary !== null) return <SessionSummary {...sitting.summary} />;

  const sign = problem.operation === "add" ? "+" : "−";

  return (
    <>
      <AppBar current="none" />
      <PageShell>
        <CampHeader
          camp={camp}
          palette={palette}
          title={mechanicLabel(camp.mechanic)}
          subtitle="Read the jump, then choose where it lands"
          mastery={state.mastery}
          onFinish={sitting.finish}
        />

        <section className="rounded-[28px] border-2 border-edge bg-surface p-5 shadow-sm sm:p-6">
          {/* From `lg` the words sit beside the board rather than above it, so a
              laptop sees the whole problem without scrolling. */}
          <div className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-center lg:gap-8">
          <div className="mb-5 text-center lg:mb-0 lg:text-left">
            <p className="text-sm text-ink-soft">
              Problem {problem.index + 1} · {state.solved} solved
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
              <p className="text-5xl font-extrabold tabular-nums tracking-tight text-ink sm:text-6xl">
                {problem.start} {sign} {problem.change} ={" "}
                {solvedNow ? (
                  <span className="text-reward-ink">{problem.answer}</span>
                ) : (
                  <span className="text-brand">?</span>
                )}
              </p>
              {sitting.readAloud && <ReadAloudButton text={spokenJump(problem, framing)} />}
            </div>
            <ProblemFraming framing={framing} theme={profile.interestTheme} />
            <p className="mt-2 text-sm text-ink-soft">Which one does the jump land on?</p>
          </div>

          <div className="relative">
            {reaction !== null && <AnswerBurst reaction={reaction} fireKey={sitting.burstKey} />}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {choices.map((choice) => {
                const chosen = round.kind !== "awaiting" && round.landed === choice;
                const isAnswer = choice === problem.answer;
                return (
                  <li key={choice}>
                    <button
                      type="button"
                      onClick={() => { dispatch({ type: "land", value: choice, at: Date.now() }); }}
                      disabled={solvedNow}
                      aria-label={`Lands on ${String(choice)}`}
                      className={`flex min-h-20 w-full items-center justify-center rounded-3xl border-2 text-3xl font-extrabold tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                        solvedNow && isAnswer
                          ? "border-reward-deep bg-reward-soft text-reward-ink"
                          : chosen
                            ? "border-info bg-info/15 text-ink"
                            : "border-edge bg-surface-tint text-ink hover:border-brand-deep"
                      }`}
                    >
                      {choice}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          </div>

          <div className="mt-5" aria-live="polite">
            <AnimatePresence mode="wait">
              {round.kind === "wrong" && (
                <motion.div
                  key={`wrong-${String(round.landed)}-${String(state.wrongAttempts)}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-3 rounded-2xl border-2 border-info bg-info/15 p-4 text-center"
                >
                  <p className="text-sm font-medium text-ink">
                    {coachLine?.line ?? diagnoseJump(problem, round.landed).nudge}
                  </p>
                  <button
                    type="button"
                    onClick={() => { dispatch({ type: "retry" }); }}
                    className="inline-flex min-h-11 items-center rounded-full border border-edge px-5 text-xs font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    Have another go
                  </button>
                </motion.div>
              )}

              {round.kind === "right" && (
                <motion.div
                  key={`right-${String(problem.index)}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="relative flex flex-col items-center gap-3 overflow-visible rounded-2xl border-2 border-reward bg-reward-soft p-4 text-center"
                >
                  <Celebration variant="burst" fireKey={state.solved} />
                  <p className="text-base font-bold text-reward-ink">
                    {problem.start} {sign} {problem.change} = {problem.answer} · +{round.gained}{" "}
                    mastery
                  </p>
                  <p className="text-sm text-ink-soft">{coachLine?.line ?? "That is the one."}</p>
                  {!isCampComplete(state.mastery) && (
                    <button
                      type="button"
                      onClick={() => { dispatch({ type: "next", at: Date.now() }); }}
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
          glyph="🏕️"
          verb="choosing"
          onKeepPractising={() => { dispatch({ type: "next", at: Date.now() }); }}
        />
      </PageShell>
    </>
  );
}
