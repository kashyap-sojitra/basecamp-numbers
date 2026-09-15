import type { CampMarkerPosition } from "@/lib/domain/camp";

/**
 * The geometry of the mountain board, as numbers a test can check rather than
 * classes that look right in one browser at one width.
 *
 * The markers cannot move, so the cards fit around fixed points: each hangs
 * right of its badge, anchored towards the middle so a tall card grows inwards.
 * Two cards may share vertical space; they must never share both axes.
 */

/** The marker badge is `size-12`. */
export const BADGE_PX = 48;
/** The card is `w-36`, and the gap between them `gap-2`. */
export const CARD_PX = 144;
export const CARD_GAP_PX = 8;
/**
 * The board never renders narrower than this, and `max-w-6xl` means it never
 * renders wider either — so the mountain is drawn at exactly one width and
 * never scrolls sideways. Below `xl` the page shows the route list instead,
 * which reads better than a mountain squeezed or scrolled.
 */
export const BOARD_MIN_PX = 1152;
/** The board's aspect ratio, as width / height. */
export const BOARD_ASPECT = 16 / 10;
/** The mountain's height in pixels; the extension shares it. */
export const BOARD_H_PX = BOARD_MIN_PX / BOARD_ASPECT;

/**
 * The backdrop is drawn in a 1000-unit-wide viewBox; the mountain is
 * `BOARD_MIN_PX` of it. The **next range** — the coming-soon camps — extends
 * the picture to the right by `EXTENSION_UNITS`, so the whole board is wider
 * than the frame it sits in and scrolls sideways under a fixed border. The
 * extension is an area of its own: its markers are percentages of *it*, so
 * the four camps' markers do not move when it grows.
 */
export const BOARD_UNITS = 1000;
export const EXTENSION_UNITS = 520;
export const EXTENSION_PX = (BOARD_MIN_PX * EXTENSION_UNITS) / BOARD_UNITS;
export const BOARD_TOTAL_PX = BOARD_MIN_PX + EXTENSION_PX;
/**
 * The board is sized from its frame in CSS, not in pixels: the mountain fills
 * the frame's inner width exactly on arrival, whatever the page's gutters
 * leave it, and the extension hangs off it in proportion. These are the
 * fractions that layout uses. `BOARD_MIN_PX` remains the reference width the
 * geometry is proved at; the proof also sweeps the narrower widths a frame
 * can actually be.
 */
export const TOTAL_UNITS = BOARD_UNITS + EXTENSION_UNITS;
/** The whole board's width as a fraction of the frame's inner width. */
export const BOARD_SCALE = TOTAL_UNITS / BOARD_UNITS;
/** The mountain's share of the whole board. */
export const MOUNTAIN_FRACTION = BOARD_UNITS / TOTAL_UNITS;
/** The board's aspect ratio as drawn, width / height. */
export const TOTAL_ASPECT = (BOARD_ASPECT * TOTAL_UNITS) / BOARD_UNITS;
/**
 * The narrowest a frame gets at `xl`: the 1280px breakpoint less the page's
 * gutters (`px-8` each side) and the frame's own 2px borders — and `max-w-6xl`
 * caps it at 1152 less the same, so the frame is this wide on any laptop.
 */
export const FRAME_MIN_PX = BOARD_MIN_PX - 2 * 32 - 2 * 2;

/**
 * The tallest a card is allowed to get before the layout stops being provable.
 * A gated camp is the fat case: chip, name, meter, a line of explanation and a
 * two-line button.
 */
export const CARD_MAX_H_PX = 220;

/**
 * A coming-soon card is smaller — a pill, a name and one line — and is swept
 * up to this height against every camp card, so the teasers can never
 * shoulder a real camp aside.
 */
export const UPCOMING_CARD_MAX_H_PX = 130;

/** Where a card sits against its badge. */
export type CardAnchor = "top" | "middle" | "bottom";

/** A card grows towards the middle of the board, never towards an edge. */
export function cardAnchor(yPercent: number): CardAnchor {
  if (yPercent < 30) return "top";
  if (yPercent > 70) return "bottom";
  return "middle";
}

export interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** A region of the board that markers are placed in by percentage. */
export interface Area {
  /** Where the area starts, in board pixels from the left. */
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

/** The mountain itself, at a given width. */
export function mountainArea(boardWidth: number): Area {
  return { left: 0, width: boardWidth, height: boardWidth / BOARD_ASPECT };
}

/** The next range, hung off the mountain's right edge. */
export function extensionArea(boardWidth: number): Area {
  return {
    left: boardWidth,
    width: (boardWidth * EXTENSION_UNITS) / BOARD_UNITS,
    height: boardWidth / BOARD_ASPECT,
  };
}

/** Where a card lands, in board pixels, for a marker placed within an area. */
export function cardBoxIn(marker: CampMarkerPosition, area: Area, cardHeight: number): Box {
  const x = area.left + (marker.xPercent / 100) * area.width;
  const y = (marker.yPercent / 100) * area.height;
  const left = x + BADGE_PX / 2 + CARD_GAP_PX;

  const anchor = cardAnchor(marker.yPercent);
  const top =
    anchor === "top"
      ? y - BADGE_PX / 2
      : anchor === "bottom"
        ? y + BADGE_PX / 2 - cardHeight
        : y - cardHeight / 2;

  return { left, right: left + CARD_PX, top, bottom: top + cardHeight };
}

/** Where one camp's card lands on a mountain of this width, in pixels. */
export function cardBox(marker: CampMarkerPosition, boardWidth: number, cardHeight: number): Box {
  return cardBoxIn(marker, mountainArea(boardWidth), cardHeight);
}

/** True when two boxes share both axes — the only overlap that shows. */
export function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** True when a box leaves the board on any side. */
export function isClipped(
  box: Box,
  boardWidth: number,
  boardHeight: number = boardWidth / BOARD_ASPECT,
): boolean {
  return box.left < 0 || box.top < 0 || box.right > boardWidth || box.bottom > boardHeight;
}
