"use client";

import { useReducer, type ReactElement, useCallback } from "react";
import { motion } from "framer-motion";
import { JumpNumberLine, lineStateFor } from "@/components/numberline/JumpNumberLine";
import type { CampDefinition, GroupingFocus, JumpSkill } from "@/lib/domain/camp";
import {
  reduceSession,
  startSession,
  type CampSession,
  type CampSessionAction,
} from "@/lib/domain/campSession";
import {
  reduceGroupingSession,
  startGroupingSession,
  type GroupingAction,
  type GroupingSession,
} from "@/lib/domain/groupingSession";
import type { ClimberProfile } from "@/lib/domain/onboarding";
import { INTEREST_PALETTES } from "@/lib/theme/interestTheme";
import { AnswerBurst } from "@/components/effects/AnswerBurst";
import { ReadAloudButton } from "@/components/ReadAloudButton";
import { spokenGrouping, spokenJump, spokenTrade } from "@/lib/ai/spokenProblem";
import { tradeHint, tradeQuestion } from "@/lib/domain/tradeCopy";
import { Keypad } from "@/components/trade/Keypad";
import { CheckpointShell } from "./CheckpointShell";
import { wantsReadAloud } from "@/lib/domain/onboarding";
import { reactionKey } from "@/lib/motion/presets";
import { YAY, groupingMiss, jumpMiss, tradeMiss } from "@/lib/domain/reaction";
import { ladderStart } from "@/lib/math/sequence";
import { GroupingBoard } from "@/components/grouping/GroupingBoard";
import { TradeMat } from "@/components/trade/TradeMat";
import { jumpChoices } from "@/lib/math/jumpChoices";
import {
  reduceTradeSession,
  startTradeSession,
  type TradeSession,
  type TradeSessionAction,
} from "@/lib/domain/tradeSession";

interface CheckpointScreenProps {
  readonly camp: CampDefinition;
  readonly profile: ClimberProfile;
  /** The learner's solve count, so a retried review is not the same three. */
  readonly totalSolves: number;
}

/**
 * A checkpoint reuses the camp's own mechanic and problem generator, so the
 * child is reviewing the real skill. The chrome and the copy are shorter than
 * a camp's: this is a quick check, not another lesson.
 */
export function CheckpointScreen({
  camp,
  profile,
  totalSolves,
}: CheckpointScreenProps): ReactElement {
  switch (camp.mechanic.kind) {
    case "number-line-jump":
      return <JumpCheckpoint camp={camp} profile={profile} skill={camp.mechanic.skill} totalSolves={totalSolves} />;
    case "pick-the-jump":
      return <PickCheckpoint camp={camp} profile={profile} skill={camp.mechanic.skill} totalSolves={totalSolves} />;
    case "array-grouping":
      return <GroupingCheckpoint camp={camp} profile={profile} focus={camp.mechanic.focus} totalSolves={totalSolves} />;
    case "trade-up":
      return <TradeCheckpoint camp={camp} profile={profile} totalSolves={totalSolves} />;
  }
}

function Prompt({
  children,
  speak,
}: {
  readonly children: React.ReactNode;
  readonly speak: string | null;
}) {
  return (
    <div className="mb-6 flex items-center justify-center gap-3">
      <p className="text-center text-4xl font-extrabold tabular-nums tracking-tight text-ink sm:text-5xl">
        {children}
      </p>
      {speak !== null && <ReadAloudButton text={speak} />}
    </div>
  );
}

function Verdict({
  right,
  onNext,
  onRetry,
}: {
  readonly right: boolean;
  readonly onNext: () => void;
  readonly onRetry: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative mt-6 flex flex-col items-center gap-3 overflow-visible rounded-2xl border-2 p-4 text-center ${
        right ? "border-reward bg-reward-soft" : "border-info bg-info/15"
      }`}
    >
      <p className={`text-base font-bold ${right ? "text-reward-ink" : "text-ink"}`}>
        {right ? "Still got it." : "Not quite — have another go."}
      </p>
      <button
        type="button"
        onClick={right ? onNext : onRetry}
        className="inline-flex min-h-11 items-center rounded-full bg-gradient-to-r from-brand to-brand-deep px-6 text-sm font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {right ? "Next question" : "Try again"}
      </button>
    </motion.div>
  );
}

function JumpCheckpoint({
  camp,
  profile,
  skill,
  totalSolves,
}: CheckpointScreenProps & { readonly skill: JumpSkill }) {
  const [state, dispatch] = useReducer(
    (current: CampSession, action: CampSessionAction) =>
      reduceSession(current, action, skill, profile.gradeBand),
    { skill, band: profile.gradeBand },
    ({ skill: s, band }) => startSession(s, band, 0, Date.now(), ladderStart(totalSolves)),
  );

  const palette = INTEREST_PALETTES[profile.interestTheme];
  const { problem, round } = state;
  const forward = problem.operation === "add";

  const lineState = lineStateFor(round);

  return (
    <CheckpointShell camp={camp} theme={profile.interestTheme} band={profile.gradeBand} solved={state.solved}>
      <Prompt speak={wantsReadAloud(profile) ? spokenJump(problem, null) : null}>
        {problem.start} {forward ? "+" : "−"} {problem.change} ={" "}
        <span className="text-brand">?</span>
      </Prompt>
      <div className="relative">
      {round.kind !== "awaiting" && (
        <AnswerBurst
          reaction={round.kind === "right" ? YAY : jumpMiss(problem, round.landed)}
          fireKey={reactionKey(state.solved, state.wrongAttempts)}
        />
      )}
      <JumpNumberLine
        problem={problem}
        state={lineState}
        palette={palette}
        onLand={(value) => { dispatch({ type: "land", value, at: Date.now() }); }}
      />
      </div>
      {round.kind !== "awaiting" && (
        <Verdict
          right={round.kind === "right"}
          onNext={() => { dispatch({ type: "next", at: Date.now() }); }}
          onRetry={() => { dispatch({ type: "retry" }); }}
        />
      )}
    </CheckpointShell>
  );
}

function GroupingCheckpoint({
  camp,
  profile,
  focus,
  totalSolves,
}: CheckpointScreenProps & { readonly focus: GroupingFocus }) {
  const [state, dispatch] = useReducer(
    (current: GroupingSession, action: GroupingAction) =>
      reduceGroupingSession(current, action, focus, profile.gradeBand),
    { focus, band: profile.gradeBand },
    ({ focus: f, band }) => startGroupingSession(f, band, 0, Date.now(), ladderStart(totalSolves)),
  );

  const palette = INTEREST_PALETTES[profile.interestTheme];
  const { task, workspace, round } = state;

  return (
    <CheckpointShell camp={camp} theme={profile.interestTheme} band={profile.gradeBand} solved={state.solved}>
      <Prompt speak={wantsReadAloud(profile) ? spokenGrouping(task, null) : null}>
        {task.kind === "array" ? `${String(task.rows)} × ${String(task.cols)}` : task.target}
      </Prompt>

      <div className="relative">
      {round.kind !== "building" && (
        <AnswerBurst
          reaction={round.kind === "right" ? YAY : groupingMiss(round.hint)}
          fireKey={reactionKey(state.solved, state.wrongAttempts)}
        />
      )}
      <GroupingBoard
          task={task}
          workspace={workspace}
          palette={palette}
          locked={round.kind === "right"}
          dispatch={dispatch}
        />
      </div>

      {round.kind !== "building" && (
        <Verdict
          right={round.kind === "right"}
          onNext={() => { dispatch({ type: "next", now: Date.now() }); }}
          onRetry={() => { dispatch({ type: "clear" }); }}
        />
      )}
    </CheckpointShell>
  );
}

function TradeCheckpoint({ camp, profile, totalSolves }: CheckpointScreenProps) {
  const [state, dispatch] = useReducer(
    (current: TradeSession, action: TradeSessionAction) =>
      reduceTradeSession(current, action, profile.gradeBand),
    { band: profile.gradeBand },
    ({ band }) => startTradeSession(band, 0, Date.now(), ladderStart(totalSolves)),
  );

  const palette = INTEREST_PALETTES[profile.interestTheme];
  const band = profile.gradeBand;
  const { task, round, entry } = state;
  const onDigit = useCallback((digit: number) => { dispatch({ type: "digit", digit }); }, []);
  const onErase = useCallback(() => { dispatch({ type: "erase" }); }, []);
  const onSubmit = useCallback(() => { dispatch({ type: "submit", at: Date.now() }); }, []);

  return (
    <CheckpointShell camp={camp} theme={profile.interestTheme} band={band} solved={state.solved}>
      <Prompt speak={wantsReadAloud(profile) ? spokenTrade(task, null) : null}>{tradeQuestion(band)}</Prompt>

      <div className="relative">
        {round.kind !== "typing" && (
          <AnswerBurst
            reaction={round.kind === "right" ? YAY : tradeMiss(round.answer, task.target)}
            fireKey={reactionKey(state.solved, state.wrongAttempts)}
          />
        )}
        <TradeMat task={task} palette={palette} />
      </div>

      <div className="mt-5 flex justify-center">
        <Keypad
          entry={entry}
          locked={round.kind !== "typing"}
          onDigit={onDigit}
          onErase={onErase}
          onSubmit={onSubmit}
        />
      </div>

      {round.kind === "wrong" && (
        <p className="mt-4 text-center text-sm font-medium text-ink" aria-live="polite">
          {tradeHint(band, round.slip)}
        </p>
      )}

      {round.kind !== "typing" && (
        <Verdict
          right={round.kind === "right"}
          onNext={() => { dispatch({ type: "next", at: Date.now() }); }}
          onRetry={() => { dispatch({ type: "clear" }); }}
        />
      )}
    </CheckpointShell>
  );
}

function PickCheckpoint({
  camp,
  profile,
  skill,
  totalSolves,
}: CheckpointScreenProps & { readonly skill: JumpSkill }) {
  const [state, dispatch] = useReducer(
    (current: CampSession, action: CampSessionAction) =>
      reduceSession(current, action, skill, profile.gradeBand),
    { skill, band: profile.gradeBand },
    ({ skill: s, band }) => startSession(s, band, 0, Date.now(), ladderStart(totalSolves)),
  );

  const { problem, round } = state;
  const choices = jumpChoices(problem, profile.gradeBand);
  const sign = problem.operation === "add" ? "+" : "−";

  return (
    <CheckpointShell camp={camp} theme={profile.interestTheme} band={profile.gradeBand} solved={state.solved}>
      <Prompt speak={wantsReadAloud(profile) ? spokenJump(problem, null) : null}>
        {problem.start} {sign} {problem.change}
      </Prompt>

      <div className="relative">
        {round.kind !== "awaiting" && (
          <AnswerBurst
            reaction={round.kind === "right" ? YAY : jumpMiss(problem, round.landed)}
            fireKey={reactionKey(state.solved, state.wrongAttempts)}
          />
        )}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {choices.map((choice) => (
            <li key={choice}>
              <button
                type="button"
                onClick={() => { dispatch({ type: "land", value: choice, at: Date.now() }); }}
                disabled={round.kind === "right"}
                aria-label={`Lands on ${String(choice)}`}
                className={`flex min-h-20 w-full items-center justify-center rounded-3xl border-2 text-3xl font-extrabold tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  round.kind === "right" && choice === problem.answer
                    ? "border-reward-deep bg-reward-soft text-reward-ink"
                    : "border-edge bg-surface-tint text-ink hover:border-brand-deep"
                }`}
              >
                {choice}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {round.kind !== "awaiting" && (
        <Verdict
          right={round.kind === "right"}
          onNext={() => { dispatch({ type: "next", at: Date.now() }); }}
          onRetry={() => { dispatch({ type: "retry" }); }}
        />
      )}
    </CheckpointShell>
  );
}
