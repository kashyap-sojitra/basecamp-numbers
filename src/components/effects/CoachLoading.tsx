"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { InterestTheme } from "@/lib/domain/onboarding";
import { INTEREST_PALETTES } from "@/lib/theme/interestTheme";

/**
 * The wait while the coach writes. Gemini takes a couple of seconds, which is
 * a long time for a child, so the wait is something to watch rather than a
 * blank space: the theme's character hops along a dotted trail while the
 * message cycles.
 */

const MESSAGES: Record<InterestTheme, readonly [string, ...string[]]> = {
  space: ["Radioing mission control…", "Charting the stars…", "Warming up the rockets…"],
  ocean: ["Diving for a story…", "Asking the dolphins…", "Following the bubbles…"],
  jungle: ["Swinging through the vines…", "Asking the toucan…", "Following the trail…"],
};

interface CoachLoadingProps {
  readonly theme: InterestTheme;
  /** `line` sits where one sentence will go; `panel` fills a card. */
  readonly variant?: "line" | "panel";
}

export function CoachLoading({ theme, variant = "line" }: CoachLoadingProps) {
  const reduced = useReducedMotion();
  const palette = INTEREST_PALETTES[theme];
  const messages = MESSAGES[theme];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // Cycles in a timer callback, never synchronously in the effect body.
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % messages.length);
    }, 1_800);
    return () => { window.clearInterval(timer); };
  }, [messages.length]);

  const hop = reduced === true ? {} : { y: [0, -10, 0] };

  return (
    <div
      className={`mx-auto flex w-full max-w-md flex-col items-center gap-2 ${
        variant === "panel" ? "py-4" : "py-1"
      }`}
      role="status"
      aria-live="polite"
      aria-label="Writing your word problem"
    >
      {/* The character hops along a dotted trail. */}
      <div className="relative flex h-9 w-full max-w-56 items-end justify-center">
        <div className="absolute bottom-1 flex w-full items-center justify-between px-1" aria-hidden>
          {[0, 1, 2, 3, 4, 5, 6].map((dot) => (
            <motion.span
              key={dot}
              className="size-1.5 rounded-full"
              style={{ backgroundColor: palette.line, opacity: 0.35 }}
              animate={reduced === true ? { opacity: 0.35 } : { opacity: [0.15, 0.6, 0.15] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: dot * 0.12 }}
            />
          ))}
        </div>
        <motion.span
          className="relative text-2xl"
          aria-hidden
          animate={reduced === true ? { x: 0 } : { ...hop, x: [-70, 70, -70] }}
          transition={{
            x: { duration: 3.2, repeat: Infinity, ease: "easeInOut" },
            y: { duration: 0.8, repeat: Infinity, ease: "easeInOut" },
          }}
        >
          {palette.glyph}
        </motion.span>
      </div>

      {/* Cycling message, cross-faded so nothing jumps. */}
      <div className="relative h-5 w-full text-center">
        <motion.p
          key={index}
          className="absolute inset-0 text-sm font-medium text-ink-soft"
          initial={reduced === true ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {messages[index] ?? messages[0]}
        </motion.p>
      </div>

      {variant === "panel" && (
        <div className="mt-1 w-full max-w-sm space-y-2" aria-hidden>
          {[0, 1].map((bar) => (
            <div key={bar} className="relative h-3 overflow-hidden rounded-full bg-surface-tint">
              {reduced !== true && (
                <motion.div
                  className="absolute inset-y-0 w-1/3"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(108,100,201,0.35), transparent)",
                  }}
                  animate={{ x: ["-100%", "300%"] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: bar * 0.25, ease: "easeInOut" }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
