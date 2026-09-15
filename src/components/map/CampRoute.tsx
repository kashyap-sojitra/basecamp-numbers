"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CampCardBody } from "./CampCardBody";
import type { Camp } from "@/lib/domain/camp";
import type { InterestPalette } from "@/lib/theme/interestTheme";
import type { GradeBand } from "@/lib/domain/onboarding";

/**
 * The route as a vertical list, for phones. The mountain needs about 760px to
 * keep four camps legible, so below that it becomes a climb you scroll up
 * rather than a picture squeezed sideways — the summit at the top, the
 * trailhead at the bottom, joined by the trail.
 */
export function CampRoute({
  camps,
  band,
  palette,
}: {
  readonly camps: readonly Camp[];
  readonly band: GradeBand;
  readonly palette: InterestPalette;
}) {
  const reduced = useReducedMotion();

  return (
    <ol className="flex flex-col-reverse gap-3" aria-label="Your camps, trailhead first">
      {camps.map((camp, index) => {
        const locked = camp.progress.status === "locked";
        const gated = camp.progress.status === "checkpoint";
        const faded = !locked && camp.progress.mastery < camp.progress.earned;

        return (
          <motion.li
            key={camp.number}
            initial={reduced === true ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * index, type: "spring", stiffness: 260, damping: 24 }}
            className="relative flex gap-3 pl-1"
          >
            {/* The trail, threading the badges. */}
            <div className="relative flex w-12 shrink-0 flex-col items-center">
              {index < camps.length - 1 && (
                <span
                  aria-hidden
                  className="absolute -top-3 h-3 w-1 rounded-full"
                  style={{ backgroundColor: palette.line, opacity: 0.35 }}
                />
              )}
              <div
                className={`flex size-12 items-center justify-center rounded-full border-[3px] text-lg font-extrabold shadow-md ${
                  locked ? "border-edge bg-surface-tint text-ink-soft" : "border-white"
                } ${gated ? "border-berry" : ""}`}
                style={
                  locked
                    ? undefined
                    : {
                        backgroundColor: palette.piece,
                        color: palette.pieceInk,
                        filter: faded ? "grayscale(0.75)" : undefined,
                        opacity: faded ? 0.75 : 1,
                      }
                }
              >
                {locked ? "🔒" : camp.number}
              </div>
              {index > 0 && (
                <span
                  aria-hidden
                  className="mt-1 w-1 flex-1 rounded-full"
                  style={{ backgroundColor: palette.line, opacity: 0.35 }}
                />
              )}
            </div>

            <div
              className={`flex-1 rounded-2xl border-2 p-3 ${
                locked
                  ? "border-edge bg-surface-tint"
                  : gated
                    ? "border-berry bg-berry/10 shadow-md"
                    : "border-brand/40 bg-surface shadow-md"
              }`}
            >
              <CampCardBody camp={camp} band={band} />
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
