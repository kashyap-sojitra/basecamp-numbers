"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CELEBRATION_COLORS } from "@/lib/motion/presets";
import { createRng, hashSeed, type Rng } from "@/lib/math/rng";

/**
 * `burst` fires outward from the middle of its container, for a single
 * correct answer. `rain` falls across the whole screen, for finishing a camp.
 */
export type CelebrationVariant = "burst" | "rain";

interface Piece {
  readonly id: number;
  readonly x: number;
  readonly dx: number;
  readonly dy: number;
  readonly rotate: number;
  readonly delay: number;
  readonly duration: number;
  readonly color: string;
  readonly square: boolean;
}

const COUNT: Record<CelebrationVariant, number> = { burst: 22, rain: 46 };

/** Random in [0, 1), from the seeded generator. */
function unit(rng: Rng): number {
  return rng.int(0, 9999) / 10000;
}

/**
 * Confetti laid out from a seed, so it is a pure function of `fireKey` — no
 * randomness during render, and the same burst on the server and the client.
 */
function makePieces(variant: CelebrationVariant, fireKey: number): readonly Piece[] {
  const rng = createRng(hashSeed(`celebration:${variant}:${String(fireKey)}`));
  const count = COUNT[variant];

  return Array.from({ length: count }, (_, i) => {
    const color = CELEBRATION_COLORS[rng.int(0, CELEBRATION_COLORS.length - 1)] ?? "var(--reward)";
    const square = unit(rng) > 0.45;

    if (variant === "rain") {
      return {
        id: i,
        x: unit(rng) * 100,
        dx: (unit(rng) - 0.5) * 120,
        dy: 320 + unit(rng) * 420,
        rotate: (unit(rng) - 0.5) * 900,
        delay: unit(rng) * 0.9,
        duration: 1.9 + unit(rng) * 0.6,
        color,
        square,
      };
    }

    const angle = (i / count) * Math.PI * 2 + unit(rng) * 0.5;
    const distance = 70 + unit(rng) * 90;
    return {
      id: i,
      x: 50,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance - 20,
      rotate: (unit(rng) - 0.5) * 540,
      delay: unit(rng) * 0.1,
      duration: 1.1,
      color,
      square,
    };
  });
}

interface CelebrationProps {
  readonly variant: CelebrationVariant;
  /** Bump this to fire again — a new value replays the celebration. */
  readonly fireKey: number;
}

/**
 * Confetti for reward moments. This is the one place warm colours are allowed
 * to run free, because finishing something is exactly what they are for.
 */
export function Celebration({ variant, fireKey }: CelebrationProps) {
  const reduced = useReducedMotion();
  const [cleared, setCleared] = useState(0);

  // Tidies the pieces away once they have fallen. The state change happens in
  // the timer callback, not in the effect body.
  useEffect(() => {
    if (fireKey === 0) return;
    const timer = window.setTimeout(() => { setCleared(fireKey); }, 2600);
    return () => { window.clearTimeout(timer); };
  }, [fireKey]);

  const active = fireKey !== 0 && cleared !== fireKey && reduced !== true;
  const pieces = useMemo(
    () => (active ? makePieces(variant, fireKey) : []),
    [active, variant, fireKey],
  );

  if (reduced === true) return null;

  const rain = variant === "rain";

  return (
    <div
      className={
        rain
          ? "pointer-events-none fixed inset-0 z-40 overflow-hidden"
          : "pointer-events-none absolute inset-0 z-10 overflow-visible"
      }
      aria-hidden
    >
      <AnimatePresence>
        {pieces.map((piece) => (
          <motion.span
            key={`${String(fireKey)}-${String(piece.id)}`}
            className={piece.square ? "absolute" : "absolute rounded-full"}
            style={{
              left: `${String(piece.x)}%`,
              top: rain ? -20 : "50%",
              width: piece.square ? 9 : 7,
              height: piece.square ? 9 : 7,
              backgroundColor: piece.color,
            }}
            initial={{ opacity: 1, x: "-50%", y: 0, rotate: 0, scale: 0.6 }}
            animate={{
              opacity: [1, 1, 0],
              x: `calc(-50% + ${String(piece.dx)}px)`,
              y: piece.dy,
              rotate: piece.rotate,
              scale: 1,
            }}
            transition={{
              duration: piece.duration,
              delay: piece.delay,
              ease: rain ? "easeIn" : "easeOut",
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
