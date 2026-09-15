"use client";

import { PLACE_LABEL, TRADE_AT, type PlaceUnit } from "@/lib/domain/grouping";
import type { InterestPalette } from "@/lib/theme/interestTheme";
import type { TradeTask } from "@/lib/math/tradeTasks";

/*
 * The pieces themselves, laid out in ten-frames.
 *
 * A column that said `14` under ONES was a number, not fourteen things, and
 * the camp's whole idea is that ten of those things become one of the next.
 * So every piece is drawn, in the 5×2 frames children already use to see ten:
 * a full frame is one trade, ringed so the group reads as a group, and the
 * spare pieces sit in a part-filled frame below it. Fourteen ones is a ringed
 * ten and four more; after the trade it is four, and the tens column has one
 * more rod. The equivalence is visible rather than only asserted.
 *
 * Geometry is in viewBox units and scales with the column, so a phone's
 * 94px column and a laptop's 112px one draw the same picture.
 */
const FRAME_COLS = TRADE_AT / 2;
const FRAME_ROWS = 2;
const CELL = 14;
const CELL_GAP = 3;
const FRAME_GAP = 7;
const PAD = 4;
const FRAME_W = FRAME_COLS * CELL + (FRAME_COLS - 1) * CELL_GAP;
const FRAME_H = FRAME_ROWS * CELL + (FRAME_ROWS - 1) * CELL_GAP;

/** One piece of a place, drawn to suggest what it is: dot, rod, flat, cube. */
function Piece({ unit, x, y, fill }: { unit: PlaceUnit; x: number; y: number; fill: string }) {
  switch (unit) {
    case 1:
      return <circle cx={x + CELL / 2} cy={y + CELL / 2} r={CELL / 2 - 1.5} fill={fill} />;
    case 10:
      return <rect x={x + 4} y={y} width={CELL - 8} height={CELL} rx={2} fill={fill} />;
    case 100:
      return <rect x={x} y={y} width={CELL} height={CELL} rx={2} fill={fill} />;
    case 1000:
      return (
        <>
          <rect x={x} y={y} width={CELL} height={CELL} rx={2} fill={fill} />
          <rect x={x + 3.5} y={y + 3.5} width={CELL - 7} height={CELL - 7} rx={1} fill="none" stroke="#ffffff" strokeWidth={1.5} />
        </>
      );
  }
}

/**
 * Every piece a place holds, in ten-frames. A full frame is ringed when the
 * place can trade it; the top place has nothing to trade into, so its full
 * frames are just full. An empty place shows one empty frame, so the space
 * reads as "none here" rather than as a gap in the layout.
 */
export function PieceGrid({
  unit,
  held,
  tradable,
  palette,
}: {
  readonly unit: PlaceUnit;
  readonly held: number;
  readonly tradable: boolean;
  readonly palette: InterestPalette;
}) {
  const frames = Math.max(1, Math.ceil(held / TRADE_AT));
  const width = FRAME_W + PAD * 2;
  const height = frames * FRAME_H + (frames - 1) * FRAME_GAP + PAD * 2;
  const pieces = Array.from({ length: held }, (_, i) => i);
  return (
    <svg
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      className="w-full max-w-24"
      aria-hidden
      data-piece-grid
    >
      {Array.from({ length: frames }, (_, f) => {
        const top = PAD + f * (FRAME_H + FRAME_GAP);
        // A full frame the place can trade is one group: ringed solid. Any
        // other frame is a faint dashed outline, there to show where ten is.
        const ringed = tradable && held >= (f + 1) * TRADE_AT;
        return (
          <rect
            key={f}
            x={PAD - 2.5}
            y={top - 2.5}
            width={FRAME_W + 5}
            height={FRAME_H + 5}
            rx={5}
            fill="none"
            stroke={palette.line}
            strokeWidth={ringed ? 2.5 : 1}
            opacity={ringed ? 1 : 0.45}
            {...(ringed ? { "data-full-frame": true } : { strokeDasharray: "3 3" })}
          />
        );
      })}
      {pieces.map((i) => {
        const frame = Math.floor(i / TRADE_AT);
        const within = i % TRADE_AT;
        const col = within % FRAME_COLS;
        const row = Math.floor(within / FRAME_COLS);
        const x = PAD + col * (CELL + CELL_GAP);
        const y = PAD + frame * (FRAME_H + FRAME_GAP) + row * (CELL + CELL_GAP);
        return (
          <g key={i} data-piece>
            <Piece unit={unit} x={x} y={y} fill={palette.piece} />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * The mat, one column per place: its label, its count and its pieces.
 *
 * Nothing on it can be pressed. It used to carry a "Trade 10" button under
 * each column, lit up on the one that could trade, which made the summit a
 * matter of tapping the highlighted button. The mat is now the question — a
 * number written the long way — and the answer is typed on the keypad beside
 * it. The ringed tens are the support: each is one of the next place up.
 */
export function TradeMat({
  task,
  palette,
}: {
  readonly task: TradeTask;
  readonly palette: InterestPalette;
}) {
  const topUnit = task.units[0];

  /*
   * On a phone the columns are a grid sized by how many places are in play —
   * three across, or two by two once thousands join — because three `min-w-28`
   * columns needed 312px and a 375px phone has 299px inside the card, so the
   * ones column kept dropping to a row of its own. From `sm` it is a flex row.
   */
  return (
    <div
      className={`grid gap-2 sm:flex sm:flex-wrap sm:items-stretch sm:justify-center sm:gap-3 ${
        task.units.length === 4 ? "grid-cols-2" : "grid-cols-3"
      }`}
    >
      {task.units.map((unit) => {
        const held = task.start[unit];
        return (
          <div
            key={unit}
            className="flex min-w-0 flex-col items-center gap-2 rounded-3xl border-2 border-edge bg-surface-tint p-2 sm:min-w-28 sm:flex-1 sm:p-3"
          >
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-brand-deep sm:text-xs sm:tracking-[0.16em]">
              {PLACE_LABEL[unit]}
            </p>
            {/* Ink, not the piece's ink: that is white, for text on a piece,
                and it made the counts vanish on the pale column. */}
            <p className="text-4xl font-extrabold tabular-nums tracking-tight text-ink">{held}</p>
            {/* The pieces, so the count is fourteen things and not a 14. */}
            <div className="flex w-full flex-1 items-start justify-center px-1">
              <PieceGrid unit={unit} held={held} tradable={unit !== topUnit} palette={palette} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
