"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SPARKLE_COLORS, pick } from "@/lib/motion/presets";

interface Sparkle {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
  readonly size: number;
  readonly color: string;
}

const PER_BURST = 9;
/** Hard cap, so a child hammering the screen cannot bog the page down. */
const MAX_LIVE = 54;

let nextId = 0;

/**
 * A little burst of colour wherever the child taps. Mounted once, listens on
 * the window, and draws nothing at all when reduced motion is requested.
 */
export function ClickSparkles() {
  const reduced = useReducedMotion();
  const [sparkles, setSparkles] = useState<readonly Sparkle[]>([]);

  const remove = useCallback((id: number) => {
    setSparkles((current) => current.filter((sparkle) => sparkle.id !== id));
  }, []);

  useEffect(() => {
    if (reduced === true) return;

    function onDown(event: PointerEvent) {
      const burst: Sparkle[] = [];
      for (let i = 0; i < PER_BURST; i += 1) {
        // Spread the burst evenly, then jitter so no two look alike.
        const angle = (i / PER_BURST) * Math.PI * 2 + Math.random() * 0.6;
        const distance = 26 + Math.random() * 46;
        burst.push({
          id: (nextId += 1),
          x: event.clientX,
          y: event.clientY,
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          size: 5 + Math.random() * 7,
          color: pick(SPARKLE_COLORS),
        });
      }
      setSparkles((current) => [...current, ...burst].slice(-MAX_LIVE));
    }

    window.addEventListener("pointerdown", onDown, { passive: true });
    return () => { window.removeEventListener("pointerdown", onDown); };
  }, [reduced]);

  if (reduced === true) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      <AnimatePresence>
        {sparkles.map((sparkle) => (
          <motion.span
            key={sparkle.id}
            className="absolute rounded-full"
            style={{
              left: sparkle.x,
              top: sparkle.y,
              width: sparkle.size,
              height: sparkle.size,
              backgroundColor: sparkle.color,
            }}
            initial={{ opacity: 1, scale: 0.4, x: "-50%", y: "-50%" }}
            animate={{
              opacity: 0,
              scale: 1.1,
              x: `calc(-50% + ${String(sparkle.dx)}px)`,
              y: `calc(-50% + ${String(sparkle.dy)}px)`,
            }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            onAnimationComplete={() => { remove(sparkle.id); }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
