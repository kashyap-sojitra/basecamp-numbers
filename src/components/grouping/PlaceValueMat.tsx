"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import type { GroupingTask, PlaceCounts, PlaceUnit } from "@/lib/domain/grouping";
import { PLACE_LABEL, TRADE_AT, overfullPlace, placeCountsValue } from "@/lib/domain/grouping";
import type { InterestPalette } from "@/lib/theme/interestTheme";
import { Base10Block } from "./Base10Block";
import { DraggablePiece } from "./DraggablePiece";
import { useScrollLock } from "@/lib/motion/useScrollLock";

interface PlaceValueMatProps {
  readonly task: Extract<GroupingTask, { kind: "place-value" }>;
  readonly counts: PlaceCounts;
  readonly palette: InterestPalette;
  readonly locked: boolean;
  readonly onPlace: (unit: PlaceUnit) => void;
  readonly onRemove: (unit: PlaceUnit) => void;
}

/**
 * Column widths follow how many blocks a place *holds*, not how big one block
 * is: ones are the smallest and most numerous, so they need the widest column
 * to read as a grid rather than a tower.
 */
const COLUMN_WIDTH: Record<PlaceUnit, string> = {
  1000: "w-[148px]",
  100: "w-[128px]",
  10: "w-[112px]",
  1: "w-[160px]",
};

export function PlaceValueMat({
  task,
  counts,
  palette,
  locked,
  onPlace,
  onRemove,
}: PlaceValueMatProps) {
  const zone = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  // An unconstrained drag can outgrow the page; a locked page cannot scroll.
  useScrollLock(dragging);
  const total = placeCountsValue(counts);
  /*
   * A mat can hold the right total and still miss the point — `14` as fourteen
   * ones is the number without the idea. When a place fills up, the ten blocks
   * that make one of the next place are ringed together and named, so the
   * equivalence is something the child can see rather than a sentence they
   * have to take on trust.
   */
  const trade = overfullPlace(counts, task.unitChoices);

  return (
    <div className="flex flex-col gap-5">
      {/* Drop zone: the whole mat. A block always lands in its own place. */}
      <div className="overflow-x-auto">
        {/* A ring, not a scale: box-shadow takes no space, and a scale tipped
            the zone out of this `overflow-x-auto` wrapper — which also arms
            `overflow-y`, so both scrollbars appeared mid-drag. */}
        <div
          ref={zone}
          className={`flex min-h-52 min-w-fit justify-center gap-2 rounded-2xl border-2 border-dashed p-3 transition-[background-color,border-color,box-shadow] duration-200 ${
            dragging ? "border-brand bg-brand/10 ring-4 ring-brand/30" : "border-edge bg-surface-tint"
          }`}
        >
          {task.unitChoices.map((unit) => (
            <div
              key={unit}
              className={`flex ${COLUMN_WIDTH[unit]} flex-col rounded-xl border border-edge bg-surface p-2`}
            >
              <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
                {PLACE_LABEL[unit]}
              </p>
              <div
                className={`flex flex-1 flex-wrap content-start justify-center gap-1.5 rounded-lg transition-[box-shadow,background-color] duration-300 ${
                  trade?.from === unit ? "bg-info/10 ring-2 ring-info" : ""
                }`}
              >
                <AnimatePresence initial={false}>
                  {Array.from({ length: counts[unit] }, (_, i) => (
                    <motion.button
                      key={i}
                      type="button"
                      disabled={locked}
                      onClick={() => { onRemove(unit); }}
                      aria-label={`Take away one ${PLACE_LABEL[unit].toLowerCase().replace(/s$/, "")} block`}
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{
                        opacity: 1,
                        scale: 1,
                        // The ten that make one pulse together, so they read as
                        // a group rather than ten separate things.
                        ...(trade?.from === unit && i < TRADE_AT ? { y: [0, -3, 0] } : { y: 0 }),
                      }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28, y: { duration: 1.1, repeat: Infinity, delay: i * 0.04 } }}
                      className="flex min-h-11 min-w-11 items-center justify-center rounded p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand enabled:hover:opacity-75"
                    >
                      <Base10Block unit={unit} color={palette.piece} />
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
              {trade?.from === unit && (
                /* Decorative: the hint panel already announces the trade, and
                   saying it twice makes a screen reader repeat itself. */
                <p className="mt-1 text-center text-[10px] font-bold leading-tight text-info" aria-hidden>
                  ten {PLACE_LABEL[unit].toLowerCase()} make one {PLACE_LABEL[trade.to].toLowerCase().replace(/s$/, "")}
                </p>
              )}
              <p className="mt-2 text-center text-xs font-bold tabular-nums text-ink">
                {counts[unit]}
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-sm text-ink-soft" aria-live="polite">
        On the mat:{" "}
        <span className="font-bold tabular-nums text-ink">{total}</span> of{" "}
        <span className="tabular-nums">{task.target}</span>
      </p>

      {/* Tray of blocks. */}
      <div className="flex flex-wrap items-end justify-center gap-3">
        {task.unitChoices.map((unit) => (
          <DraggablePiece
            key={unit}
            dropZone={zone}
            disabled={locked}
            onDrop={() => { onPlace(unit); }}
            label={`Add one ${PLACE_LABEL[unit].toLowerCase().replace(/s$/, "")} block, worth ${String(unit)}`}
            onDragActive={setDragging}
          >
            <span className="flex flex-col items-center gap-1.5">
              <Base10Block unit={unit} color={palette.piece} />
              <span className="text-[11px] font-semibold text-ink-soft">{unit}</span>
            </span>
          </DraggablePiece>
        ))}
      </div>
    </div>
  );
}
