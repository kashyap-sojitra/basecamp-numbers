"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

/**
 * A soft blob of colour that trails the pointer, a beat behind. Mouse only —
 * it never appears on touch, where there is no cursor to follow.
 */
export function CursorGlow() {
  const reduced = useReducedMotion();
  const [awake, setAwake] = useState(false);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  // The lag is the point: it makes the glow feel like it is chasing.
  const x = useSpring(rawX, { stiffness: 140, damping: 18, mass: 0.7 });
  const y = useSpring(rawY, { stiffness: 140, damping: 18, mass: 0.7 });

  useEffect(() => {
    if (reduced === true) return;

    function onMove(event: MouseEvent) {
      rawX.set(event.clientX);
      rawY.set(event.clientY);
      setAwake(true);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => { window.removeEventListener("mousemove", onMove); };
  }, [rawX, rawY, reduced]);

  if (reduced === true || !awake) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed z-0 size-64 rounded-full blur-3xl"
      style={{
        x,
        y,
        translateX: "-50%",
        translateY: "-50%",
        background:
          "radial-gradient(circle, rgba(108,100,201,0.20), rgba(23,226,234,0.12) 45%, transparent 70%)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    />
  );
}
