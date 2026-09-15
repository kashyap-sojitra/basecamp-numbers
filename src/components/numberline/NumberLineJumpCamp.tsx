"use client";

import { useReducer } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AnswerBurst } from "@/components/effects/AnswerBurst";
import { Celebration } from "@/components/effects/Celebration";
import type { CampDefinition, JumpSkill, Mastery } from "@/lib/domain/camp";
import type { CampSession, CampSessionAction } from "@/lib/domain/campSession";
import { reduceSession, startSession } from "@/lib/domain/campSession";
import { isCampComplete } from "@/lib/domain/mastery";
import type { LearnerProgress } from "@/lib/domain/progress";
import type { ClimbContext } from "@/lib/domain/milestones";
import { SessionSummary } from "@/components/summary/SessionSummary";
import { jumpSkillDescription, jumpSkillPhrase } from "@/lib/domain/numberLine";
import type { ClimberProfile } from "@/lib/domain/onboarding";
import { useEncouragement, useWordProblem } from "@/lib/ai/useCoach";
import { spokenJump } from "@/lib/ai/spokenProblem";
import { ReadAloudButton } from "@/components/ReadAloudButton";
import { INTEREST_PALETTES } from "@/lib/theme/interestTheme";
import { JumpNumberLine, lineStateFor } from "./JumpNumberLine";
import { answerOutcome, useCampSitting } from "@/lib/progress/useCampSitting";
import { ladderStart } from "@/lib/math/sequence";
import { diagnoseJump } from "@/lib/domain/jumpDiagnosis";
import { YAY, jumpMiss, type Reaction } from "@/lib/domain/reaction";
import { castFor } from "@/lib/ai/cast";
import type { FramingRequest } from "@/lib/ai/types";
import { ProblemFraming } from "@/components/ProblemFraming";
import { AppBar } from "@/components/AppBar";
import { PageShell } from "@/components/PageShell";
import { CampHeader } from "@/components/CampHeader";
import { CampMasteredBanner } from "@/components/CampMasteredBanner";

interface NumberLineJumpCampProps {
  readonly camp: CampDefinition;
  /** Which number-line skill this camp practises. */
  readonly skill: JumpSkill;
  readonly profile: ClimberProfile;
  /** This camp's saved Mastery Meter, loaded on the server. */
  readonly startingMastery: Mastery;
  /** The learner's whole record as it stood when this screen loaded. */
  readonly progressAtStart: LearnerProgress;
  /** The climb log, for streaks and personal bests on the summary. */
  readonly climb: ClimbContext;
}

export function NumberLineJumpCamp({
  camp,
  skill,
  profile,
  startingMastery,
  progressAtStart,
  climb,
}: NumberLineJumpCampProps) {
  const [state, dispatch] = useReducer(
    (current: CampSession, action: CampSessionAction) =>
      reduceSession(current, action, skill, profile.gradeBand),
    { skill, band: profile.gradeBand, startingMastery },
    ({ skill: s, band, startingMastery: seed }) => startSession(s, band, seed, Date.now(), ladderStart(progressAtStart.totalSolves)),
  );

  const palette = INTEREST_PALETTES[profile.interestTheme];
  const { problem, round } = state;
  const forward = problem.operation === "add";

  // Writing solves through, the child's own day, the read-aloud decision, the
  // reaction key and the end-of-sitting summary are all the same on every camp
  // screen, so they live in one hook rather than in each.
  const sitting = useCampSitting({
    camp: camp.number,
    campName: camp.name,
    skill: jumpSkillPhrase(skill, profile.gradeBand),
    profile,
    progressAtStart,
    climb,
    tally: state,
  });

  // The words come from the coach; every number in them is one we supplied.
  /*
   * One request, two uses: the coach words the story from it and the board
   * takes its climber from it. `castFor` is deterministic in the request, so
   * the friend in the sentence is provably the friend on the line.
   */
  const framingRequest: FramingRequest = {
    kind: "jump",
    theme: profile.interestTheme,
    operation: problem.operation,
    start: problem.start,
    change: problem.change,
  };
  const framing = useWordProblem(framingRequest);
  /*
   * The coach is told *which* slip this was, not merely that there was one.
   * The rule diagnoses — that is arithmetic — and the model finds words a
   * six-year-old wants to hear, which is not. Without this it was handed
   * "they answered wrongly and will try again" and could only be vague.
   */
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

  // The reaction plays over the line, where the child was looking — never on
  // top of the words and the button they need next.
  const reaction: Reaction | null =
    round.kind === "right" ? YAY : round.kind === "wrong" ? jumpMiss(problem, round.landed) : null;

  if (sitting.summary !== null) return <SessionSummary {...sitting.summary} />;

  const lineState = lineStateFor(round);


  return (
    <>
      <AppBar current="none" />
      <PageShell>
        <CampHeader
          camp={camp}
          palette={palette}
          title={"Number-line jump"}
          subtitle={jumpSkillDescription(skill, profile.gradeBand)}
          mastery={state.mastery}
          onFinish={sitting.finish}
        />

        <section className="rounded-[28px] border-2 border-edge bg-surface p-5 shadow-sm sm:p-6">
          {/* The problem */}
          <div className="mb-2 text-center">
            <p className="text-sm text-ink-soft">
              Jump {state.problem.index + 1} · {state.solved} landed
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <p className="text-5xl font-extrabold tabular-nums tracking-tight text-ink sm:text-6xl">
                {problem.start} {forward ? "+" : "−"} {problem.change} ={" "}
                <span className="text-brand">?</span>
              </p>
              {sitting.readAloud && <ReadAloudButton text={spokenJump(problem, framing)} />}
            </div>
            <ProblemFraming framing={framing} theme={profile.interestTheme} />
            <p className="mt-2 text-sm text-ink-soft">
              Start at <span className="font-semibold text-ink">{problem.start}</span> and
              jump <span className="font-semibold text-ink">{problem.change}</span>{" "}
              {forward ? "forward" : "back"}. Tap where you land.
            </p>
          </div>

          <div className="relative mt-6">
            {reaction !== null && <AnswerBurst reaction={reaction} fireKey={sitting.burstKey} />}
            <JumpNumberLine
              problem={problem}
              state={lineState}
              palette={palette}
              climber={castFor(framingRequest).glyph}
              onLand={(value) => { dispatch({ type: "land", value, at: Date.now() }); }}
            />
          </div>

          {/* Feedback */}
          <div className="mt-5" aria-live="polite">
            <AnimatePresence mode="wait">
              {round.kind === "wrong" && (
                <motion.div
                  key={`wrong-${String(round.landed)}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="relative flex flex-col items-center gap-3 overflow-visible rounded-2xl border-2 border-info bg-info/15 p-4 text-center"
                >
                  <p className="text-sm font-medium text-ink">
                    You landed on {round.landed}. {diagnoseJump(problem, round.landed).nudge}
                  </p>
                  <button
                    type="button"
                    onClick={() => { dispatch({ type: "retry" }); }}
                    className="inline-flex min-h-11 items-center rounded-full bg-gradient-to-r from-brand to-brand-deep px-6 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    Try again
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
                    {problem.start} {forward ? "+" : "−"} {problem.change} = {problem.answer} · +
                    {round.gained} mastery
                  </p>
                  <p className="text-sm text-ink-soft">
                    {coachLine?.line ??
                      (state.wrongAttempts === 0
                        ? "Straight there. Nice jump!"
                        : "You found it — well climbed.")}
                  </p>
                  {!isCampComplete(state.mastery) && (
                    <button
                      type="button"
                      onClick={() => { dispatch({ type: "next", at: Date.now() }); }}
                      className="inline-flex min-h-11 items-center rounded-full bg-gradient-to-r from-brand to-brand-deep px-6 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      Next jump
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
          glyph={"🏕️"}
          verb="jumping"
          onKeepPractising={() => { dispatch({ type: "next", at: Date.now() }); }}
        />
      </PageShell>
    </>
  );
}
