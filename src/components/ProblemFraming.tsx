"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CoachLoading } from "@/components/effects/CoachLoading";
import type { InterestTheme } from "@/lib/domain/onboarding";
import type { WordProblemFraming } from "@/lib/ai/types";

/** The coach's words, fading in over the loader so nothing pops. */
export function ProblemFraming({
  framing,
  theme,
}: {
  readonly framing: WordProblemFraming | null;
  readonly theme: InterestTheme;
}) {
  return (
    <div className="mt-3 min-h-16">
      <AnimatePresence mode="wait">
        {framing === null ? (
          <motion.div key="loading" exit={{ opacity: 0 }}>
            <CoachLoading theme={theme} />
          </motion.div>
        ) : (
          <motion.p
            key={framing.story}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="mx-auto max-w-md text-base font-medium text-ink"
          >
            {framing.story} <span className="text-brand-deep">{framing.question}</span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
