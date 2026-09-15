"use client";

import { motion, useReducedMotion } from "framer-motion";

/** The wait inside a button, so a tap never looks like it did nothing. */
export function ButtonSpinner() {
  const reduced = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      className="inline-block size-4 shrink-0 rounded-full border-2 border-white/40 border-t-white"
      animate={reduced === true ? {} : { rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
    />
  );
}
