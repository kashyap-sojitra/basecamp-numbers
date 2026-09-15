"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Celebration } from "@/components/effects/Celebration";
import { CoachLoading } from "@/components/effects/CoachLoading";
import type { CampDefinition } from "@/lib/domain/camp";
import { CHECKPOINT_QUESTIONS } from "@/lib/domain/decay";
import type { InterestTheme } from "@/lib/domain/onboarding";
import { ROUTES, API } from "@/lib/routes";
import type { GradeBand } from "@/lib/domain/onboarding";
import { AppBar } from "@/components/AppBar";
import { PageShell } from "@/components/PageShell";
import { checkpointCopy } from "@/lib/domain/checkpointCopy";

interface CheckpointShellProps {
  readonly camp: CampDefinition;
  /** For the loader shown while the restore is in flight. */
  readonly theme: InterestTheme;
  /** Decides how the review is described — see `checkpointCopy`. */
  readonly band: GradeBand;
  /** How many of the checkpoint's questions are done. */
  readonly solved: number;
  readonly children: ReactNode;
}

/**
 * The frame around a checkpoint. Deliberately does not look like a camp:
 * berry chrome, a bell, and a row of dots, so it is obvious the child has been
 * pulled back for a review rather than sent somewhere new.
 */
export function CheckpointShell({ camp, theme, band, solved, children }: CheckpointShellProps) {
  const copy = checkpointCopy(band);
  const finished = solved >= CHECKPOINT_QUESTIONS;
  const [restored, setRestored] = useState<"pending" | "done" | "failed">("pending");

  useEffect(() => {
    if (!finished) return;
    let cancelled = false;

    async function restore() {
      try {
        const response = await fetch(API.checkpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ camp: camp.number }),
        });
        if (!cancelled) setRestored(response.ok ? "done" : "failed");
      } catch (error) {
        console.error("[checkpoint] could not restore the camp:", error);
        if (!cancelled) setRestored("failed");
      }
    }

    void restore();
    return () => { cancelled = true; };
  }, [finished, camp.number]);

  return (
    <>
      <AppBar current="none" />
      <PageShell>
        <header className="mb-6 rounded-3xl border-2 border-berry bg-berry/10 p-5">
          <div className="flex flex-wrap items-center gap-4">
            <motion.span
              aria-hidden
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-berry text-2xl shadow-md"
              animate={{ rotate: [0, -14, 14, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            >
              🔔
            </motion.span>
            <div className="min-w-48 flex-1">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-berry-ink">
                {copy.reviewEyebrow}
              </p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
                Camp {camp.number} · {camp.name}
              </h1>
              <p className="mt-1 text-sm text-ink-soft">
                {copy.reviewSubtitle}
              </p>
            </div>

            {/* One dot per question, filled as they go. */}
            <div className="flex items-center gap-2" aria-label={`${String(solved)} of ${String(CHECKPOINT_QUESTIONS)} done`}>
              {Array.from({ length: CHECKPOINT_QUESTIONS }, (_, i) => (
                <motion.span
                  key={i}
                  className={`size-4 rounded-full border-2 ${
                    i < solved ? "border-berry bg-berry" : "border-berry/40 bg-transparent"
                  }`}
                  animate={i < solved ? { scale: [1, 1.5, 1] } : { scale: 1 }}
                  transition={{ duration: 0.4 }}
                />
              ))}
            </div>
          </div>
        </header>

        {!finished && (
          <section className="rounded-[28px] border-2 border-edge bg-surface p-5 shadow-sm sm:p-8">
            {children}
          </section>
        )}

        <AnimatePresence>
          {finished && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative flex flex-col items-center gap-3 overflow-visible rounded-[28px] border-2 border-reward bg-gradient-to-b from-reward-soft to-surface p-8 text-center"
            >
              <Celebration variant="rain" fireKey={1} />
              <p className="text-3xl" aria-hidden>💪</p>
              <h2 className="text-2xl font-extrabold text-reward-ink">
                {copy.done(camp.number)}
              </h2>
              {restored === "pending" ? (
                <div className="w-full max-w-sm">
                  <CoachLoading theme={theme} />
                </div>
              ) : (
                <p className="max-w-sm text-sm text-ink-soft">
                  {restored === "failed"
                    ? "You did the review, but we could not save it. Try heading back and again in a moment."
                    : "Its Mastery Meter is back where you earned it. The way up is open."}
                </p>
              )}
              {restored !== "pending" && (
                <Link
                  href={ROUTES.map}
                  transitionTypes={["nav-back"]}
                  className="mt-1 inline-flex min-h-11 items-center rounded-full bg-gradient-to-r from-brand to-brand-deep px-6 text-sm font-extrabold text-white shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  Back to the map
                </Link>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {!finished && (
          <p className="mt-5 text-center text-sm text-ink-soft">
            <Link
              href={ROUTES.map}
              transitionTypes={["nav-back"]}
              className="inline-flex min-h-11 items-center rounded-full px-3 underline hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              Back to the map
            </Link>{" "}
            — the checkpoint will still be here.
          </p>
        )}
      </PageShell>
    </>
  );
}
