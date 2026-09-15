"use client";

import { AppBar } from "@/components/AppBar";
import { PageShell } from "@/components/PageShell";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Celebration } from "@/components/effects/Celebration";
import { CoachLoading } from "@/components/effects/CoachLoading";
import { MasteryMeter } from "@/components/MasteryMeter";
import { CAMP_DEFINITIONS } from "@/lib/data/camps";
import type { SessionSummaryData } from "@/lib/domain/sessionSummary";
import type { Milestone } from "@/lib/domain/milestones";
import { starReason } from "@/lib/domain/stars";
import type { ClimberProfile } from "@/lib/domain/onboarding";
import { useSessionSummary } from "@/lib/ai/useCoach";
import { SPRING } from "@/lib/motion/presets";
import { ROUTES } from "@/lib/routes";

interface SessionSummaryProps {
  readonly summary: SessionSummaryData;
  readonly campName: string;
  /** What this camp practises, in plain words, for the summary line. */
  readonly skill: string;
  readonly profile: ClimberProfile;
  /** Bests, streaks and badges this sitting crossed. Often empty. */
  readonly milestones: readonly Milestone[];
  /** The slips made in this sitting, so the line can name what improved. */
  readonly slips: readonly string[];
  /** Lets the child carry on at the same camp. */
  readonly onKeepGoing: () => void;
}

function Star({ filled, index }: { readonly filled: boolean; readonly index: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.span
      className={`text-5xl sm:text-6xl ${filled ? "" : "opacity-25 grayscale"}`}
      initial={reduced === true || !filled ? false : { scale: 0, rotate: -60 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ ...SPRING.bounce, delay: 0.15 + index * 0.18 }}
      aria-hidden
    >
      ★
    </motion.span>
  );
}

export function SessionSummary({
  summary,
  campName,
  skill,
  profile,
  milestones,
  slips,
  onKeepGoing,
}: SessionSummaryProps) {
  // The screen shows the numbers; the line says what got better.
  const line = useSessionSummary({
    theme: profile.interestTheme,
    skill,
    shape: summary.shape,
    masteryRose: summary.masteryRose,
    campCompleted: summary.campCompleted,
    // The useful half: a slip that stopped happening is what improved.
    slips: [...slips],
  });

  const earnedStars = summary.stars;

  return (
    <>
      <AppBar current="none" />
      <PageShell>
        {/* A column of cards reads best narrow; the shell keeps the gutters uniform. */}
        <div className="mx-auto w-full max-w-3xl">
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING.settle}
            className="relative overflow-visible rounded-[28px] border-2 border-reward bg-gradient-to-b from-reward-soft to-surface p-6 text-center sm:p-8"
          >
            {earnedStars > 0 && <Celebration variant="rain" fireKey={earnedStars} />}

            <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-reward-ink">
              Session complete
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink">{campName}</h1>

            {/* Stars */}
            <div
              className="mt-4 flex items-center justify-center gap-2 text-reward"
              role="img"
              aria-label={`${String(earnedStars)} of 3 stars`}
            >
              {[0, 1, 2].map((index) => (
                <Star key={index} filled={index < earnedStars} index={index} />
              ))}
            </div>
            <p className="mt-2 text-sm font-semibold text-ink">{starReason(summary.tally)}</p>

            {/* The one AI line. Falls back to a template server-side, so this only
                waits for the round trip. */}
            <div className="mx-auto mt-5 min-h-24 max-w-md rounded-2xl bg-surface/70 p-3">
              <AnimatePresence mode="wait">
                {line === null ? (
                  <motion.div key="loading" exit={{ opacity: 0 }}>
                    <CoachLoading theme={profile.interestTheme} variant="panel" />
                  </motion.div>
                ) : (
                  <motion.p
                    key={line.line}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="text-base font-medium text-ink"
                  >
                    {line.line}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.section>

          {/* What this sitting crossed. Warm colours, because these are the only
              reward moments on the screen besides the stars. */}
          {milestones.length > 0 && (
            <section
              aria-labelledby="milestones-heading"
              className="mt-6 rounded-[28px] border-2 border-reward-deep bg-reward-soft p-5 sm:p-6"
            >
              <h2
                id="milestones-heading"
                className="mb-4 text-xs font-extrabold uppercase tracking-[0.22em] text-reward-ink"
              >
                New today
              </h2>
              <ul className="flex flex-col gap-3">
                {milestones.map((milestone, index) => (
                  <motion.li
                    key={milestone.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...SPRING.settle, delay: 0.3 + index * 0.12 }}
                    className="flex items-center gap-4 rounded-2xl bg-surface p-3"
                  >
                    <span
                      aria-hidden
                      className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-reward-soft text-2xl"
                    >
                      {milestone.glyph}
                    </span>
                    <div className="min-w-0">
                      <p className="text-base font-extrabold text-ink">{milestone.headline}</p>
                      <p className="text-sm text-ink-soft">{milestone.detail}</p>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </section>
          )}

          {/* Before and after, for every camp — so the child sees this session
              lift one meter and let the others slip. */}
          <section className="mt-6 rounded-[28px] border-2 border-edge bg-surface p-5 sm:p-6">
            <h2 className="mb-4 text-lg font-bold text-ink">Your meters</h2>
            <ul className="flex flex-col gap-4">
              {summary.camps.map((delta) => {
                const definition = CAMP_DEFINITIONS.find((c) => c.number === delta.camp);
                const moved = delta.after.shown - delta.before.shown;
                return (
                  <li key={delta.camp} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-bold text-ink">
                        Camp {delta.camp} · {definition?.name ?? ""}
                        {delta.practised && (
                          <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                            Today
                          </span>
                        )}
                      </p>
                      <p className="shrink-0 text-xs font-bold tabular-nums text-ink-soft">
                        {delta.before.shown} →{" "}
                        <span
                          className={
                            moved > 0 ? "text-reward-ink" : moved < 0 ? "text-berry-ink" : "text-ink-soft"
                          }
                        >
                          {delta.after.shown}
                        </span>
                        {moved !== 0 && (
                          <span className={moved > 0 ? "text-reward-ink" : "text-berry-ink"}>
                            {" "}
                            ({moved > 0 ? "+" : ""}
                            {moved})
                          </span>
                        )}
                      </p>
                    </div>
                    <MasteryMeter mastery={delta.after.shown} earned={delta.after.earned} />
                    {delta.after.needsReview && (
                      <p className="text-xs font-bold text-berry-ink">
                        Gone dim — a checkpoint will bring it back.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onKeepGoing}
              className="rounded-full border-2 border-edge bg-surface px-6 py-3 text-sm font-bold text-ink transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              Keep climbing here
            </button>
            <Link
              href={ROUTES.log}
              transitionTypes={["nav-forward"]}
              className="rounded-full border-2 border-edge bg-surface px-6 py-3 text-sm font-bold text-ink transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <span aria-hidden className="mr-1">🏅</span>
              My progress
            </Link>
            <Link
              href={ROUTES.map}
              transitionTypes={["nav-back"]}
              className="rounded-full bg-gradient-to-r from-brand to-brand-deep px-6 py-3 text-sm font-extrabold text-white shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              Back to the map
            </Link>
          </div>
        </div>
      </PageShell>
    </>
  );
}
