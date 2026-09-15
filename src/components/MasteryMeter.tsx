"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Mastery } from "@/lib/domain/camp";
import { MASTERY_MAX } from "@/lib/domain/mastery";
import { SPRING } from "@/lib/motion/presets";

interface MasteryMeterProps {
  /** The meter as shown, after decay. */
  readonly mastery: Mastery;
  /** What was earned here. Anything above `mastery` has dimmed away. */
  readonly earned?: Mastery;
  readonly size?: "sm" | "lg";
}

const clamp = (value: number): number =>
  Math.max(0, Math.min(MASTERY_MAX, Math.round(value)));

/**
 * Mastery Meter. The fill is warm because a mastery gain is a reward moment.
 * When a camp has gone stale, the ground it lost stays on the bar as a striped
 * ghost so the dimming is something the child can see, not just infer.
 */
export function MasteryMeter({ mastery, earned, size = "sm" }: MasteryMeterProps) {
  const reduced = useReducedMotion();
  const shown = clamp(mastery);
  const peak = clamp(Math.max(earned ?? mastery, mastery));
  const dimmed = peak - shown;
  const large = size === "lg";

  return (
    <div className={large ? "" : "mt-2"}>
      <div
        className={`mb-1 flex items-center justify-between font-semibold uppercase tracking-wider text-ink-soft ${
          large ? "text-xs" : "text-[10px]"
        }`}
      >
        <span>Mastery</span>
        <span className="flex items-baseline gap-1">
          {/* Keyed on the value, so each gain remounts and pops. */}
          <motion.span
            key={shown}
            className={large ? "font-bold text-reward-ink" : undefined}
            initial={reduced === true ? false : { scale: 1.7, y: -3 }}
            animate={{ scale: 1, y: 0 }}
            transition={SPRING.bounce}
          >
            {shown}
          </motion.span>
          {dimmed > 0 && (
            <span className="font-bold text-berry-ink" title={`Dimmed by ${String(dimmed)}`}>
              ▼{dimmed}
            </span>
          )}
        </span>
      </div>

      <div
        role="meter"
        aria-valuenow={shown}
        aria-valuemin={0}
        aria-valuemax={MASTERY_MAX}
        aria-label={
          dimmed > 0
            ? `Mastery Meter, ${String(shown)} of ${String(MASTERY_MAX)}, dimmed from ${String(peak)}`
            : "Mastery Meter"
        }
        className={`relative w-full overflow-hidden rounded-full bg-edge ring-1 ring-inset ring-ink/35 ${large ? "h-3" : "h-2"}`}
      >
        {/* The ground lost to decay, striped so it reads as "was here". */}
        {dimmed > 0 && (
          <motion.div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${String(peak)}%`,
              backgroundImage:
                "repeating-linear-gradient(135deg, var(--berry) 0 3px, transparent 3px 7px)",
              opacity: 0.85,
            }}
            initial={false}
            animate={{ width: `${String(peak)}%` }}
            transition={reduced === true ? { duration: 0 } : SPRING.settle}
          />
        )}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-reward to-reward-deep ring-1 ring-inset ring-ink/70"
          initial={false}
          animate={{ width: `${String(shown)}%` }}
          transition={reduced === true ? { duration: 0 } : SPRING.settle}
        />
        {reduced !== true && shown > 0 && (
          <motion.div
            key={`shine-${String(shown)}`}
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-16"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent)",
            }}
            initial={{ x: "-4rem", opacity: 0 }}
            animate={{ x: `${String(shown)}%`, opacity: [0, 1, 0] }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        )}
      </div>
    </div>
  );
}
