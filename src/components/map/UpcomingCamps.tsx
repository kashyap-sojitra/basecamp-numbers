"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { UpcomingCamp } from "@/lib/domain/camp";
import { BADGE_PX, cardAnchor } from "@/lib/domain/mapLayout";

/**
 * The camps that are coming soon, shown so a child knows the climb goes on.
 *
 * Nothing here is a camp: no link, no button, no meter, no lock glyph. A
 * dashed ghost of a badge and a small card that says what the camp will
 * practise — the promise is "there is more", not "you are locked out", which
 * is why it never borrows the locked camp's padlock. Cool colours only; there
 * is nothing to reward yet.
 */

const CHIP =
  "inline-block rounded-full bg-surface-tint px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ink-soft";

function GhostBadge({ number }: { number: UpcomingCamp["number"] }) {
  return (
    <div
      aria-hidden
      className="flex size-12 items-center justify-center rounded-full border-[3px] border-dashed border-edge bg-surface text-lg font-extrabold text-ink-soft"
    >
      {number}
    </div>
  );
}

function UpcomingBody({ camp }: { camp: UpcomingCamp }) {
  return (
    <>
      <p className={CHIP}>Coming soon</p>
      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
        Camp {camp.number}
      </p>
      <p className="text-sm font-semibold text-ink">{camp.name}</p>
      <p className="mt-0.5 text-xs leading-snug text-ink-soft">{camp.skill}</p>
    </>
  );
}

/**
 * A teaser on the mountain board: a ghost badge on the marker, its card hung
 * to the right exactly as a camp's is, so the same layout proof covers it.
 */
export function UpcomingMarker({ camp, order }: { camp: UpcomingCamp; order: number }) {
  const reduced = useReducedMotion();
  const anchor = cardAnchor(camp.marker.yPercent);
  const cardPosition =
    anchor === "top" ? "top-0" : anchor === "bottom" ? "bottom-0" : "top-1/2 -translate-y-1/2";
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.8 + order * 0.15, duration: 0.5 }}
      className="absolute"
      data-upcoming={camp.number}
      style={{
        left: `${String(camp.marker.xPercent)}%`,
        top: `${String(camp.marker.yPercent)}%`,
        translate: `${String(-BADGE_PX / 2)}px ${String(-BADGE_PX / 2)}px`,
      }}
    >
      {/* A slower, gentler drift than the camps: this range is far away. */}
      <motion.div
        className="relative size-12"
        animate={reduced === true ? { y: 0 } : { y: [0, -4, 0] }}
        transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut", delay: order * 0.7 }}
      >
        <GhostBadge number={camp.number} />
        <div
          className={`absolute left-[calc(100%+0.5rem)] w-36 rounded-2xl border-2 border-dashed border-edge bg-surface p-3 ${cardPosition}`}
        >
          <UpcomingBody camp={camp} />
        </div>
      </motion.div>
    </motion.div>
  );
}

/** The same teasers for the phone's route list, above the summit. */
export function UpcomingList({ camps }: { camps: readonly UpcomingCamp[] }) {
  return (
    <ul className="mb-3 flex flex-col-reverse gap-3" aria-label="Coming soon">
      {camps.map((camp) => (
        <li key={camp.number} className="flex gap-3 pl-1" data-upcoming={camp.number}>
          <div className="flex w-12 shrink-0 items-start justify-center">
            <GhostBadge number={camp.number} />
          </div>
          <div className="flex-1 rounded-2xl border-2 border-dashed border-edge bg-surface p-3">
            <UpcomingBody camp={camp} />
          </div>
        </li>
      ))}
    </ul>
  );
}
