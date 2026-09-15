"use client";

import { useCallback, useReducer } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AnswerBurst } from "@/components/effects/AnswerBurst";
import { Celebration } from "@/components/effects/Celebration";
import type { CampDefinition, Mastery } from "@/lib/domain/camp";
import { mechanicLabel } from "@/lib/domain/camp";
import type { TradeSession, TradeSessionAction } from "@/lib/domain/tradeSession";
import { reduceTradeSession, startTradeSession } from "@/lib/domain/tradeSession";
import { isCampComplete } from "@/lib/domain/mastery";
import { YAY, tradeMiss, type Reaction } from "@/lib/domain/reaction";
import type { LearnerProgress } from "@/lib/domain/progress";
import type { ClimbContext } from "@/lib/domain/milestones";
import type { ClimberProfile } from "@/lib/domain/onboarding";
import { SessionSummary } from "@/components/summary/SessionSummary";
import { useEncouragement, useWordProblem } from "@/lib/ai/useCoach";
import { INTEREST_PALETTES } from "@/lib/theme/interestTheme";
import { answerOutcome, useCampSitting } from "@/lib/progress/useCampSitting";
import { ladderStart } from "@/lib/math/sequence";
import { ProblemFraming } from "@/components/ProblemFraming";
import { ReadAloudButton } from "@/components/ReadAloudButton";
import { spokenTrade } from "@/lib/ai/spokenProblem";
import {
  matReading,
  tradeHint,
  tradeInstruction,
  tradeQuestion,
  tradeSubtitle,
} from "@/lib/domain/tradeCopy";
import { AppBar } from "@/components/AppBar";
import { PageShell } from "@/components/PageShell";
import { CampHeader } from "@/components/CampHeader";
import { CampMasteredBanner } from "@/components/CampMasteredBanner";
import { TradeMat } from "@/components/trade/TradeMat";
import { Keypad } from "@/components/trade/Keypad";

interface TradeUpCampProps {
  readonly camp: CampDefinition;
  readonly profile: ClimberProfile;
  readonly startingMastery: Mastery;
  readonly progressAtStart: LearnerProgress;
  readonly climb: ClimbContext;
}

/**
 * Camp 4, the summit: the mat shows a number the long way and the child
 * works out what it is worth and types it. See `tradeSession.ts` for why this
 * is typed and not tapped.
 */
export function TradeUpCamp({
  camp,
  profile,
  startingMastery,
  progressAtStart,
  climb,
}: TradeUpCampProps) {
  const [state, dispatch] = useReducer(
    (current: TradeSession, action: TradeSessionAction) =>
      reduceTradeSession(current, action, profile.gradeBand),
    { band: profile.gradeBand, startingMastery },
    ({ band, startingMastery: seed }) =>
      startTradeSession(band, seed, Date.now(), ladderStart(progressAtStart.totalSolves)),
  );

  const { task, round, entry } = state;
  const band = profile.gradeBand;
  const palette = INTEREST_PALETTES[profile.interestTheme];
  const reaction: Reaction | null =
    round.kind === "right"
      ? YAY
      : round.kind === "wrong"
        ? tradeMiss(round.answer, task.target)
        : null;

  const sitting = useCampSitting({
    camp: camp.number,
    campName: camp.name,
    skill: "reading tens, hundreds and thousands as one number",
    profile,
    progressAtStart,
    climb,
    tally: state,
  });

  // A word problem whose operands are the counts on the mat. The value is the
  // answer, and the guard throws away any story that says it.
  const framing = useWordProblem({
    kind: "trade-up",
    theme: profile.interestTheme,
    piles: task.units.map((unit) => ({ unit, count: task.start[unit] })),
    target: task.target,
  });
  const coachLine = useEncouragement(
    round.kind === "typing"
      ? null
      : {
          theme: profile.interestTheme,
          outcome: answerOutcome(round.kind === "right", state.wrongAttempts),
          ...(round.kind === "wrong" ? { hint: tradeHint(band, round.slip) } : {}),
        },
  );

  const onDigit = useCallback((digit: number) => { dispatch({ type: "digit", digit }); }, []);
  const onErase = useCallback(() => { dispatch({ type: "erase" }); }, []);
  const onSubmit = useCallback(() => { dispatch({ type: "submit", at: Date.now() }); }, []);

  if (sitting.summary !== null) return <SessionSummary {...sitting.summary} />;

  return (
    <>
      <AppBar current="none" />
      <PageShell>
        <CampHeader
          camp={camp}
          palette={palette}
          title={mechanicLabel(camp.mechanic)}
          subtitle={tradeSubtitle(band)}
          mastery={state.mastery}
          onFinish={sitting.finish}
        />

        <section className="rounded-[28px] border-2 border-edge bg-surface p-5 shadow-sm sm:p-6">
          {/* Read top to bottom on a phone: the question, the mat it is about,
              then the keypad, then what happened. From `lg` the words and the
              keypad take the left column and the mat and the feedback the
              right, so a laptop sees the whole problem without scrolling. */}
          <div className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-rows-[auto_auto] lg:items-start lg:gap-x-8 lg:gap-y-5">
            <div className="mb-5 text-center lg:mb-0 lg:text-left">
              <p className="text-sm text-ink-soft">
                Task {task.index + 1} · {state.solved} done
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 lg:justify-start">
                <h2 className="text-2xl font-extrabold tracking-tight text-ink">
                  {tradeQuestion(band)}
                </h2>
                {sitting.readAloud && <ReadAloudButton text={spokenTrade(task, framing)} />}
              </div>
              <ProblemFraming framing={framing} theme={profile.interestTheme} />
              <p className="mt-2 text-sm text-ink-soft">{tradeInstruction(band)}</p>
            </div>

            <div className="relative lg:col-start-2 lg:row-start-1">
              {reaction !== null && <AnswerBurst reaction={reaction} fireKey={sitting.burstKey} />}
              <TradeMat task={task} palette={palette} />
            </div>

            <div className="mt-5 flex justify-center lg:col-start-1 lg:row-start-2 lg:mt-0 lg:justify-start">
              <Keypad
                entry={entry}
                locked={round.kind !== "typing"}
                onDigit={onDigit}
                onErase={onErase}
                onSubmit={onSubmit}
              />
            </div>

          <div className="mt-5 lg:col-start-2 lg:row-start-2 lg:mt-0" aria-live="polite">
            <AnimatePresence mode="wait">
              {round.kind === "wrong" && (
                <motion.div
                  key={`wrong-${String(round.answer)}-${String(state.wrongAttempts)}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-3 rounded-2xl border-2 border-info bg-info/15 p-4 text-center"
                >
                  <p className="text-sm font-medium text-ink">
                    {coachLine?.line ?? tradeHint(band, round.slip)}
                  </p>
                  <button
                    type="button"
                    onClick={() => { dispatch({ type: "clear" }); }}
                    className="inline-flex min-h-11 items-center rounded-full border border-edge px-5 text-xs font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    Try again
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
                  {/* The mat read back as a sum, now that the number is found. */}
                  <p className="text-base font-bold text-reward-ink">
                    {matReading(band, task.start, task.units, task.target)} · +{round.gained} mastery
                  </p>
                  <p className="text-sm text-ink-soft">
                    {coachLine?.line ?? "You read the whole number."}
                  </p>
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
          </div>
        </section>

        <Celebration
          variant="rain"
          fireKey={isCampComplete(state.mastery) && state.solved > 0 ? 1 : 0}
        />

        <CampMasteredBanner
          camp={camp.number}
          complete={isCampComplete(state.mastery)}
          glyph="🏔️"
          verb="reading numbers"
          onKeepPractising={() => { dispatch({ type: "next", at: Date.now() }); }}
        />
      </PageShell>
    </>
  );
}
