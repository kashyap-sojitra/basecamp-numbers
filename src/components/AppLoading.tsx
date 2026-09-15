"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AppBar } from "@/components/AppBar";
import { PageShell } from "@/components/PageShell";

/**
 * The loader between screens. Route loaders render before any data is read, so
 * this cannot know the child's interest theme — it stays in brand colours and
 * shows a climber working up a rope, which is at least on-metaphor.
 */
export function AppLoading({
  label,
  destinations = true,
}: {
  readonly label: string;
  /** False on the onboarding route: a first-time climber has nowhere else to go yet. */
  readonly destinations?: boolean;
}) {
  const reduced = useReducedMotion();

  // The bar is static markup, so it is here before any data is: the screen
  // that follows then slides in under it rather than pushing it into place.
  return (
    <>
      <AppBar current="none" destinations={destinations} />
      <PageShell className="items-center justify-center gap-5">
      <div className="relative flex h-28 w-16 items-end justify-center" aria-hidden>
        {/* The rope. */}
        <span className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 rounded-full bg-edge" />
        {/* Three knots, lighting up in turn. */}
        {[0, 1, 2].map((knot) => (
          <motion.span
            key={knot}
            className="absolute left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-brand"
            style={{ bottom: 12 + knot * 32 }}
            animate={reduced === true ? { opacity: 0.5 } : { opacity: [0.2, 1, 0.2], scale: [1, 1.4, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: knot * 0.2 }}
          />
        ))}
        {/* The climber. */}
        <motion.span
          className="relative text-3xl"
          animate={reduced === true ? { y: 0 } : { y: [0, -62, 0] }}
          transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
        >
          🧗
        </motion.span>
      </div>

      <p className="text-base font-semibold text-ink" role="status">
        {label}
      </p>

      {/* A shimmering rail, so it reads as progress rather than a freeze. */}
      <div className="relative h-2 w-48 overflow-hidden rounded-full bg-edge" aria-hidden>
        {reduced !== true && (
          <motion.div
            className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-brand to-brand-deep"
            animate={{ x: ["-120%", "320%"] }}
            transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>
      </PageShell>
    </>
  );
}
