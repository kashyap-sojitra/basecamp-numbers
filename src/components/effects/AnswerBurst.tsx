"use client";

import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createRng, hashSeed, type Rng } from "@/lib/math/rng";
import { reactionWord, type Reaction } from "@/lib/domain/reaction";

/**
 * The reaction to an answer. A right answer gets a shower of emoji and a big
 * YAY; a wrong one gets a warm, curious stamp whose word says how far off it
 * was — `reactionWord` in `lib/domain/reaction.ts` decides it — never a
 * cross, a red, or a sad face. Getting it wrong is part of climbing, so the
 * nay has to feel like an invitation to try again rather than a telling-off.
 */
type BurstKind = Reaction["kind"];

const EMOJI: Record<BurstKind, readonly [string, ...string[]]> = {
  yay: ["🎉", "✨", "⭐", "🌟", "💫", "🥳", "🙌"],
  miss: ["🤔", "💭", "👀", "🧐"],
};

const COUNT: Record<BurstKind, number> = { yay: 14, miss: 6 };

interface Particle {
  readonly id: number;
  readonly emoji: string;
  readonly dx: number;
  readonly dy: number;
  readonly rotate: number;
  readonly delay: number;
  readonly scale: number;
}

/** Random in [0, 1) from the seeded generator, so nothing is impure. */
function unit(rng: Rng): number {
  return rng.int(0, 9999) / 10000;
}

function makeParticles(kind: BurstKind, fireKey: number): readonly Particle[] {
  const rng = createRng(hashSeed(`burst:${kind}:${String(fireKey)}`));
  const count = COUNT[kind];
  const reach = kind === "yay" ? 130 : 60;

  return Array.from({ length: count }, (_, i) => {
    const pool = EMOJI[kind];
    // Fan them out evenly, then jitter so no two bursts look alike.
    const angle = (i / count) * Math.PI * 2 + unit(rng) * 0.7;
    const distance = reach * (0.55 + unit(rng) * 0.65);
    return {
      id: i,
      emoji: pool[rng.int(0, pool.length - 1)] ?? pool[0],
      dx: Math.cos(angle) * distance,
      // Biased upward: things that fly up read as celebration.
      dy: Math.sin(angle) * distance - (kind === "yay" ? 30 : 12),
      rotate: (unit(rng) - 0.5) * (kind === "yay" ? 200 : 60),
      delay: unit(rng) * 0.12,
      scale: 0.9 + unit(rng) * 0.7,
    };
  });
}

interface AnswerBurstProps {
  readonly reaction: Reaction;
  /** Bump to fire again. 0 means nothing has happened yet. */
  readonly fireKey: number;
}

export function AnswerBurst({ reaction, fireKey }: AnswerBurstProps) {
  const reduced = useReducedMotion();
  const { kind } = reaction;
  const particles = useMemo(
    () => (fireKey === 0 ? [] : makeParticles(kind, fireKey)),
    [kind, fireKey],
  );

  if (fireKey === 0) return null;

  const yay = kind === "yay";

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-visible" aria-hidden>
      {/* The stamp. Sits dead centre and springs in. */}
      <AnimatePresence>
        <motion.div
          key={`stamp-${String(fireKey)}`}
          className="absolute left-1/2 top-[30%]"
          initial={
            reduced === true
              ? { opacity: 1, x: "-50%", y: "-50%" }
              : { opacity: 0, scale: 0.2, rotate: yay ? -18 : 0, x: "-50%", y: "-50%" }
          }
          animate={{
            opacity: [0, 1, 1, 0],
            scale: reduced === true ? 1 : yay ? [0.2, 1.25, 1, 1] : [0.6, 1.1, 1, 1],
            rotate: reduced === true ? 0 : yay ? [-18, 6, -3, 0] : [0, -6, 6, 0],
          }}
          transition={{ duration: yay ? 1.5 : 1.2, times: [0, 0.25, 0.7, 1] }}
        >
          <span
            className={`inline-block rounded-2xl px-5 py-2 text-2xl font-extrabold shadow-lg sm:text-3xl ${
              yay ? "bg-reward text-ink" : "bg-brand text-white"
            }`}
          >
            {reactionWord(reaction)}
          </span>
        </motion.div>
      </AnimatePresence>

      {/* Flying emoji. */}
      {reduced !== true &&
        particles.map((p) => (
          <motion.span
            key={`${String(fireKey)}-${String(p.id)}`}
            className="absolute left-1/2 top-[30%] text-2xl"
            initial={{ opacity: 0, x: "-50%", y: "-50%", scale: 0.3, rotate: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: `calc(-50% + ${String(p.dx)}px)`,
              y: `calc(-50% + ${String(p.dy)}px)`,
              scale: p.scale,
              rotate: p.rotate,
            }}
            transition={{
              duration: yay ? 1.5 : 1.1,
              delay: p.delay,
              ease: "easeOut",
              times: [0, 0.15, 0.65, 1],
            }}
          >
            {p.emoji}
          </motion.span>
        ))}
    </div>
  );
}
