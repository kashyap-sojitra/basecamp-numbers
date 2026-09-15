"use client";

import { useEffect } from "react";
import { useMotionValue, useReducedMotion, useSpring, type MotionValue } from "framer-motion";
import type { RefObject } from "react";

interface Parallax {
  /** -1 (pointer at the left edge) to 1 (right edge), spring-smoothed. */
  readonly x: MotionValue<number>;
  readonly y: MotionValue<number>;
}

/**
 * Pointer position relative to an element, as motion values. These update
 * outside React's render loop, so following the mouse costs no re-renders.
 * Returns a resting 0,0 when the child has asked for reduced motion.
 */
export function usePointerParallax(ref: RefObject<Element | null>): Parallax {
  const reduced = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 90, damping: 20, mass: 0.6 });
  const y = useSpring(rawY, { stiffness: 90, damping: 20, mass: 0.6 });

  useEffect(() => {
    if (reduced === true) return;

    function onMove(event: MouseEvent) {
      const element = ref.current;
      if (element === null) return;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const nx = (event.clientX - rect.left) / rect.width;
      const ny = (event.clientY - rect.top) / rect.height;
      rawX.set(Math.max(-1, Math.min(1, nx * 2 - 1)));
      rawY.set(Math.max(-1, Math.min(1, ny * 2 - 1)));
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => { window.removeEventListener("mousemove", onMove); };
  }, [ref, rawX, rawY, reduced]);

  return { x, y };
}
