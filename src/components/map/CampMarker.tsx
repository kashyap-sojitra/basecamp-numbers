"use client";

import { ViewTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Camp } from "@/lib/domain/camp";
import { CampCardBody, LockGlyph } from "./CampCardBody";
import type { InterestPalette } from "@/lib/theme/interestTheme";
import type { GradeBand } from "@/lib/domain/onboarding";
import { BADGE_PX, cardAnchor } from "@/lib/domain/mapLayout";

interface CampMarkerProps {
  readonly camp: Camp;
  readonly band: GradeBand;
  readonly palette: InterestPalette;
  readonly order: number;
}

export function CampMarker({ camp, band, palette, order }: CampMarkerProps) {
  const reduced = useReducedMotion();
  const { progress } = camp;
  const locked = progress.status === "locked";
  const gated = progress.status === "checkpoint";
  // A camp whose own meter has dimmed is drawn faded, so the map shows at a
  // glance which camp has gone stale.
  const faded = progress.status !== "locked" && progress.mastery < progress.earned;
  /*
   * Every card hangs right of its badge and is anchored towards the middle of
   * the board, so a tall card grows inwards and cannot be clipped. The markers
   * cannot move — the backdrop's path threads them — so the cards give way.
   * `mapLayout.test.ts` proves the arithmetic.
   */
  // `cardAnchor` is the rule; `mapLayout.test.ts` proves that following it
  // keeps every card on the board and clear of its neighbours.
  const anchor = cardAnchor(camp.marker.yPercent);
  const cardPosition =
    anchor === "top" ? "top-0" : anchor === "bottom" ? "bottom-0" : "top-1/2 -translate-y-1/2";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.15 + order * 0.12, type: "spring", stiffness: 220, damping: 22 }}
      className="absolute"
      style={{
        left: `${String(camp.marker.xPercent)}%`,
        top: `${String(camp.marker.yPercent)}%`,
        // Half the badge, so the *badge* sits on the marker whatever the card
        // beside it does. Centring the whole row instead made the card's height
        // move the badge off the trail, and pushed tall cards past the edge.
        // Uses the `translate` property rather than a transform utility, so
        // Framer's scale animation on this element composes instead of fighting.
        translate: `${String(-BADGE_PX / 2)}px ${String(-BADGE_PX / 2)}px`,
      }}
    >
      {/* A slow bob, offset per camp, so the mountain feels alive. */}
      <motion.div
        className="relative size-12"
        animate={reduced === true ? { y: 0 } : { y: [0, -7, 0] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: order * 0.45 }}
      >
        {/* Marker badge — the only thing in flow, so it holds the trail. */}
        <div className="relative size-full">
          {!locked && (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{ boxShadow: `0 0 0 3px ${gated ? "var(--berry)" : palette.piece}` }}
              animate={{ opacity: [0.7, 0, 0.7], scale: [1, 1.5, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          {/* Named so it can grow into the camp screen's badge. */}
          <ViewTransition name={`camp-${String(camp.number)}`} share="camp-morph" default="none">
            <div
              className={`relative flex size-12 items-center justify-center rounded-full border-[3px] text-lg font-extrabold shadow-md ${
                locked ? "border-edge bg-surface-tint text-ink-soft" : "border-white"
              } ${gated ? "border-berry" : ""}`}
              style={
                locked
                  ? undefined
                  : {
                      backgroundColor: palette.piece,
                      color: palette.pieceInk,
                      // Faded camps literally lose their colour.
                      filter: faded ? "grayscale(0.75)" : undefined,
                      opacity: faded ? 0.75 : 1,
                    }
              }
            >
              {locked ? <LockGlyph /> : camp.number}
            </div>
          </ViewTransition>
        </div>

        {/* Label card, hung off the badge so its height cannot move the badge.
            `w-36` and `gap-2` are CARD_PX and CARD_GAP_PX — Tailwind needs the
            literals, so change them together. */}
        <div
          className={`absolute left-[calc(100%+0.5rem)] w-36 rounded-2xl border-2 p-3 ${cardPosition} ${
            locked
              ? "border-edge bg-surface-tint"
              : gated
                ? "border-berry bg-berry-soft shadow-lg"
                : "border-brand/40 bg-surface shadow-lg"
          }`}
        >
          <CampCardBody camp={camp} band={band} compact />
        </div>
      </motion.div>
    </motion.div>
  );
}
