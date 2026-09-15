"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { CampNumber } from "@/lib/domain/camp";
import { ROUTES } from "@/lib/routes";

/** Camp complete — a reward moment, so the warm palette leads. */
export function CampMasteredBanner({
  camp,
  complete,
  glyph,
  verb,
  onKeepPractising,
}: {
  readonly camp: CampNumber;
  readonly complete: boolean;
  readonly glyph: string;
  /** "jumping" or "building" — what the child keeps doing to stay sharp. */
  readonly verb: string;
  readonly onKeepPractising: () => void;
}) {
  return (
    <AnimatePresence>
      {complete && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mt-6 flex flex-col items-center gap-3 rounded-[28px] border-2 border-reward bg-gradient-to-b from-reward-soft to-surface p-6 text-center"
        >
          <p className="text-2xl" aria-hidden>{glyph}</p>
          <h2 className="text-2xl font-extrabold text-reward-ink">Camp {camp} mastered!</h2>
          <p className="max-w-sm text-sm text-ink-soft">
            Your Mastery Meter is full. Keep {verb} to stay sharp, or head back to the map.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onKeepPractising}
              className="inline-flex min-h-11 items-center rounded-full border border-edge px-5 text-sm font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              Keep practising
            </button>
            <Link
              href={ROUTES.map}
              transitionTypes={["nav-back"]}
              className="inline-flex min-h-11 items-center rounded-full bg-gradient-to-r from-reward to-reward-deep px-5 text-sm font-bold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              Back to the map
            </Link>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
