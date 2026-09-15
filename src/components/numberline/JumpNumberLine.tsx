"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { JumpProblem } from "@/lib/domain/numberLine";
import type { InterestPalette } from "@/lib/theme/interestTheme";
import type { Round } from "@/lib/domain/campSession";

/** What the line is currently showing. */
export type LineState =
  | { readonly kind: "awaiting" }
  | { readonly kind: "landed"; readonly landed: number; readonly correct: boolean };

/** How a resolved round reads to the line. Derived, never stored. */
export function lineStateFor(round: Round): LineState {
  return round.kind === "awaiting"
    ? { kind: "awaiting" }
    : { kind: "landed", landed: round.landed, correct: round.kind === "right" };
}

interface JumpNumberLineProps {
  readonly problem: JumpProblem;
  readonly state: LineState;
  readonly palette: InterestPalette;
  /**
   * The face that rides the jump — the same friend the story names. Falls back
   * to the theme's glyph, which is what it used to always be.
   */
  readonly climber?: string;
  readonly onLand: (value: number) => void;
}

/** Every integer tick the line draws, low to high. */
function ticksOf(problem: JumpProblem): readonly number[] {
  const { min, max } = problem.line;
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

/**
 * The tick row's content starts this far in: 1px border plus `px-1` (4px). The
 * arc lane is inset to match, so an arc endpoint sits exactly on a tick.
 */
export const TICK_INSET = 5;

/**
 * The narrowest a tick column may get before the line starts scrolling
 * sideways. Columns flex wider than this whenever there is room — a 21-tick
 * line on a desktop card lands at about 42px each with no scrolling at all —
 * and every column is a full 44px tall regardless.
 */
export const MIN_TICK_PX = 34;

export interface ArcGeometry {
  /** Y of the two endpoints, just above the ticks. */
  readonly baseline: number;
  /** How far above the baseline the curve peaks. */
  readonly apex: number;
  /** Quadratic control point Y — twice the apex, so the curve peaks at it. */
  readonly controlY: number;
  /** Y the curve actually reaches at its highest point. */
  readonly apexY: number;
  readonly d: string;
}

/**
 * The jump arc, in pixels. A quadratic from `startX` to `landedX` peaks at
 * exactly `apex` above the baseline, because a quadratic reaches the midpoint
 * of its control point: y(0.5) = baseline - apex when controlY = baseline -
 * 2 * apex. Longer jumps arc higher, capped so the curve never leaves the lane.
 */
export function arcGeometry(startX: number, landedX: number, height: number): ArcGeometry {
  const baseline = Math.max(1, height - 4);
  const apex = Math.max(6, Math.min(baseline - 8, 28 + Math.abs(landedX - startX) * 0.22));
  const controlY = baseline - apex * 2;
  return {
    baseline,
    apex,
    controlY,
    apexY: baseline - apex,
    d: `M ${String(startX)} ${String(baseline)} Q ${String((startX + landedX) / 2)} ${String(controlY)} ${String(landedX)} ${String(baseline)}`,
  };
}

interface LaneSize {
  readonly width: number;
  readonly height: number;
}

/**
 * The arc is drawn in real pixels rather than a stretched viewBox. A
 * `viewBox="0 0 100 100"` with `preserveAspectRatio="none"` scales x about
 * nine times more than y, and the dash pattern Framer uses to draw the arc on
 * is computed in that distorted space — which tore the curve open near the
 * apex, where the distortion changes fastest. A 1:1 space has no distortion to
 * disagree about.
 */
function useLaneSize(ref: React.RefObject<Element | null>): LaneSize {
  const [size, setSize] = useState<LaneSize>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) return;
      // Rounded: contentRect is fractional, and comparing fractions with ===
      // lets a sub-pixel wobble re-render for ever.
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    });
    observer.observe(element);
    return () => { observer.disconnect(); };
  }, [ref]);

  return size;
}

export function JumpNumberLine({ problem, state, palette, climber, onLand }: JumpNumberLineProps) {
  const reduced = useReducedMotion();
  const lane = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const tickRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [scrollable, setScrollable] = useState(false);
  const { width, height } = useLaneSize(lane);
  const ticks = ticksOf(problem);
  // Roving tabindex: the whole line is one tab stop, and the arrow keys walk
  // it. Tabbing through thirty-one separate buttons is not "keyboard
  // operable" in any useful sense.
  const [focusIndex, setFocusIndex] = useState(0);
  const labelEvery = ticks.length <= 21 ? 1 : 5;
  const interactive = state.kind === "awaiting";

  // Flex columns of equal width, so a tick's centre is at (i + 0.5) / count.
  const centerOf = (value: number): number =>
    ((value - problem.line.min + 0.5) / ticks.length) * width;

  const startX = centerOf(problem.start);
  const landedX = state.kind === "landed" ? centerOf(state.landed) : startX;
  const showArc =
    width > 0 && state.kind === "landed" && state.landed !== problem.start;

  const arc = arcGeometry(startX, landedX, height);

  // On a phone the line is wider than the screen, so it brings the current
  // jump into view rather than leaving a child to discover the swipe.
  useEffect(() => {
    const el = scroller.current;
    if (el === null) return;
    const frame = requestAnimationFrame(() => {
      const overflows = el.scrollWidth > el.clientWidth + 1;
      setScrollable(overflows);
      if (!overflows) return;
      const span = problem.line.max - problem.line.min + 1;
      const middle = (problem.start + problem.answer) / 2 - problem.line.min + 0.5;
      const left = (middle / span) * el.scrollWidth - el.clientWidth / 2;
      el.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    });
    return () => { cancelAnimationFrame(frame); };
  }, [problem.index, problem.start, problem.answer, problem.line.min, problem.line.max]);

  function moveFocus(to: number) {
    const clamped = Math.max(0, Math.min(ticks.length - 1, to));
    setFocusIndex(clamped);
    tickRefs.current[clamped]?.focus();
  }

  function onTickKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 5 : 1;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        event.preventDefault();
        moveFocus(focusIndex + step);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        event.preventDefault();
        moveFocus(focusIndex - step);
        break;
      case "Home":
        event.preventDefault();
        moveFocus(0);
        break;
      case "End":
        event.preventDefault();
        moveFocus(ticks.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div className="relative w-full">
      {/* Soft edges, so it reads as "there is more line this way". */}
      {scrollable && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-surface to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-surface to-transparent"
          />
        </>
      )}
      <div
        ref={scroller}
        className="w-full overflow-x-auto overflow-y-hidden overscroll-x-contain"
      >
      {/* The arc and the ticks share one width, so an arc end lands on a tick
          even once the line is wider than the screen. */}
      <div className="w-full" style={{ minWidth: ticks.length * MIN_TICK_PX }}>
      {/* Arc lane above the line, inset to match the tick row's padding. */}
      <div className="relative h-20 px-[5px] sm:h-24">
        <div ref={lane} className="relative size-full">
        <svg
          viewBox={`0 0 ${String(Math.max(1, width))} ${String(Math.max(1, height))}`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 size-full"
          aria-hidden
        >
          {showArc && (
            <g key={`${String(problem.index)}-${String(state.landed)}`}>
              {/* Halo, so the arc stays legible crossing the ticks. */}
              <motion.path
                d={arc.d}
                fill="none"
                stroke="var(--surface)"
                strokeWidth="9"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
              />
              <motion.path
                d={arc.d}
                fill="none"
                stroke={state.correct ? "var(--reward-deep)" : palette.line}
                strokeWidth="5"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
              />
              {/* A head on the arc, so it reads as a jump that landed. */}
              <motion.circle
                r="6"
                cx={landedX}
                cy={arc.baseline}
                fill={state.correct ? "var(--reward-deep)" : palette.line}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, type: "spring", stiffness: 400, damping: 18 }}
                style={{ transformOrigin: `${String(landedX)}px ${String(arc.baseline)}px` }}
              />
            </g>
          )}
        </svg>

        {/* The jump size, riding the top of the arc. */}
        {showArc && (
          <motion.span
            key={`label-${String(problem.index)}-${String(state.landed)}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`pointer-events-none absolute -translate-x-1/2 rounded-full px-2.5 py-1 text-xs font-bold ${
              state.correct
                ? "bg-reward text-ink"
                : "border border-edge bg-surface text-ink"
            }`}
            style={{ left: (startX + landedX) / 2, top: Math.max(0, arc.apexY - 30) }}
          >
            {state.landed > problem.start ? "+" : "−"}
            {Math.abs(state.landed - problem.start)}
          </motion.span>
        )}

        {/* The climber rides the arc itself via `offsetPath`, which is why
            `arcGeometry` returns `d`. Under `reduce` it simply arrives. */}
        <motion.span
          key={`climber-${String(problem.index)}-${String(state.kind === "landed" ? state.landed : "waiting")}`}
          className="pointer-events-none absolute left-0 top-0 text-2xl"
          style={{ offsetPath: `path("${arc.d}")`, offsetRotate: "0deg" }}
          initial={{ offsetDistance: showArc && reduced !== true ? "0%" : "100%" }}
          animate={{
            offsetDistance: "100%",
            scaleY: showArc && reduced !== true ? [1, 0.88, 1.08, 1] : 1,
          }}
          transition={
            reduced === true
              ? { duration: 0 }
              : { offsetDistance: { duration: 0.55, ease: "easeOut" }, scaleY: { delay: 0.5, duration: 0.3 } }
          }
          aria-hidden
        >
          {climber ?? palette.glyph}
        </motion.span>
        </div>
      </div>

      {/* The line: one column per integer, so spacing is exactly even. */}
      <div
        className="flex w-full items-stretch rounded-2xl border border-edge bg-surface-tint px-1 pb-2 pt-0"
        role="group"
        aria-label={`Number line from ${String(problem.line.min)} to ${String(problem.line.max)}. Use the arrow keys to move along it, then press Enter to land.`}
        onKeyDown={onTickKeyDown}
      >
        {ticks.map((value, index) => {
          const labeled = (value - problem.line.min) % labelEvery === 0;
          const isStart = value === problem.start;
          const isLanded = state.kind === "landed" && state.landed === value;

          return (
            <button
              key={value}
              ref={(element) => { tickRefs.current[index] = element; }}
              type="button"
              disabled={!interactive}
              tabIndex={index === focusIndex ? 0 : -1}
              onClick={() => { onLand(value); }}
              onFocus={() => { setFocusIndex(index); }}
              aria-label={`Land on ${String(value)}`}
              className={`group flex min-h-11 flex-1 flex-col items-center rounded-xl pt-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                interactive ? "hover:bg-brand/15 active:bg-brand/25" : ""
              }`}
            >
              {/* Rail segment */}
              <span
                className="h-1 w-full rounded-full"
                style={{ backgroundColor: palette.line, opacity: 0.3 }}
              />
              {/* Fixed-height slot: the mark grows inside it, so the row's
                  height never changes and the mouse cannot shift the layout. */}
              <span className="mt-0.5 flex h-4 w-full items-start justify-center">
                <span
                  className={`w-0.5 rounded-full transition-all ${labeled ? "h-3" : "h-1.5"} ${
                    interactive ? "group-hover:h-4 group-hover:w-1" : ""
                  }`}
                  style={{
                    backgroundColor: isLanded
                      ? state.correct
                        ? "var(--reward-deep)"
                        : palette.piece
                      : palette.line,
                  }}
                />
              </span>
              <span
                className={`mt-0.5 text-[10px] tabular-nums transition-colors sm:text-xs ${
                  isStart ? "font-bold text-ink" : "text-ink-soft"
                } ${labeled ? "" : "invisible"} ${
                  interactive ? "group-hover:font-bold group-hover:text-brand-deep" : ""
                }`}
              >
                {value}
              </span>
            </button>
          );
        })}
      </div>
      </div>
      </div>
    </div>
  );
}
