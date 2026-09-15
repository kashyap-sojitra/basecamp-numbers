"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import type { GroupingTask } from "@/lib/domain/grouping";
import type { InterestPalette } from "@/lib/theme/interestTheme";
import { DraggablePiece } from "./DraggablePiece";
import { useScrollLock } from "@/lib/motion/useScrollLock";

interface ArrayFrameProps {
  readonly task: Extract<GroupingTask, { kind: "array" }>;
  readonly strips: readonly number[];
  readonly palette: InterestPalette;
  readonly locked: boolean;
  readonly onPlace: (length: number) => void;
  readonly onRemove: (at: number) => void;
}

function TileRow({ length, color }: { length: number; color: string }) {
  return (
    <span className="flex gap-1">
      {Array.from({ length }, (_, i) => (
        <span
          key={i}
          className="block size-4 rounded-[3px] sm:size-5"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
}

export function ArrayFrame({
  task,
  strips,
  palette,
  locked,
  onPlace,
  onRemove,
}: ArrayFrameProps) {
  const zone = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  // An unconstrained drag can outgrow the page; a locked page cannot scroll.
  useScrollLock(dragging);
  const tiles = strips.reduce((sum, length) => sum + length, 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Drop zone: the array frame. */}
      {/* A ring, not a scale — see PlaceValueMat for what scaling a drop zone
          does to the layout around it. */}
      <div
        ref={zone}
        className={`flex min-h-40 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed p-4 transition-[background-color,border-color,box-shadow] duration-200 ${
          dragging ? "border-brand bg-brand/10 ring-4 ring-brand/30" : "border-edge bg-surface-tint"
        }`}
      >
        {strips.length === 0 ? (
          <p className="text-sm text-ink-soft">Drag a row of tiles in here</p>
        ) : (
          <AnimatePresence initial={false}>
            {strips.map((length, index) => (
              <motion.span
                // Rows are positional, so the index is the identity here.
                key={`${String(index)}-${String(length)}`}
                initial={{ opacity: 0, scale: 0.9, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 340, damping: 26 }}
                className="block"
              >
                <TileRow length={length} color={palette.piece} />
              </motion.span>
            ))}
          </AnimatePresence>
        )}
      </div>

      {strips.length > 0 && !locked && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => { onRemove(strips.length - 1); }}
            className="inline-flex min-h-11 items-center rounded-full border-2 border-edge bg-surface px-5 text-xs font-bold text-ink transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Take off the last row
          </button>
        </div>
      )}

      <p className="text-center text-sm text-ink-soft" aria-live="polite">
        {strips.length === 0
          ? `Target: ${String(task.rows)} rows of ${String(task.cols)}`
          : `${String(strips.length)} ${strips.length === 1 ? "row" : "rows"} · ${String(tiles)} tiles`}
      </p>

      {/* Tray of row-strips to choose from. */}
      <div className="flex flex-wrap items-end justify-center gap-3">
        {task.stripChoices.map((length) => (
          <DraggablePiece
            key={length}
            dropZone={zone}
            disabled={locked}
            onDrop={() => { onPlace(length); }}
            label={`Add a row of ${String(length)}`}
            onDragActive={setDragging}
          >
            <span className="flex flex-col items-center gap-1.5">
              <TileRow length={length} color={palette.piece} />
              <span className="text-[11px] font-semibold text-ink-soft">{length}</span>
            </span>
          </DraggablePiece>
        ))}
      </div>
    </div>
  );
}
