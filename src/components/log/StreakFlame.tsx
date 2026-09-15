"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { StreakView } from "@/lib/domain/streak";

/**
 * The streak's own glyph. A live streak flickers; a resting one sits still and
 * pale rather than being crossed out — a lapsed streak is not a failure.
 */
export function StreakFlame({ view, size = "text-4xl" }: {
  readonly view: StreakView;
  readonly size?: string;
}) {
  const reduced = useReducedMotion();
  const alive = view.status === "climbing";

  return (
    <motion.span
      aria-hidden
      className={`${size} ${alive ? "" : "opacity-45 saturate-50"}`}
      animate={
        alive && reduced !== true
          ? { scale: [1, 1.14, 1], rotate: [-4, 4, -4] }
          : { scale: 1, rotate: 0 }
      }
      transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
    >
      {alive ? "🔥" : "🕯️"}
    </motion.span>
  );
}
