import { describe, expect, it } from "vitest";
import {
  BOARD_H_PX,
  BOARD_MIN_PX,
  BOARD_TOTAL_PX,
  CARD_MAX_H_PX,
  EXTENSION_PX,
  FRAME_MIN_PX,
  MOUNTAIN_FRACTION,
  BOARD_SCALE,
  TOTAL_ASPECT,
  UPCOMING_CARD_MAX_H_PX,
  cardAnchor,
  cardBox,
  cardBoxIn,
  extensionArea,
  isClipped,
  overlaps,
} from "./mapLayout";
import { CAMP_DEFINITIONS, UPCOMING_CAMPS } from "@/lib/data/camps";

/**
 * The board is drawn at exactly one width. The narrower entries are kept as a
 * margin check: if a future change makes the layout depend on extra width, it
 * fails here rather than on someone's laptop.
 */
const WIDTHS = [FRAME_MIN_PX, BOARD_MIN_PX, 1100, 1200, 1400];

function boxesAt(width: number, cardHeight: number) {
  return CAMP_DEFINITIONS.map((camp) => ({
    camp: camp.number,
    box: cardBox(camp.marker, width, cardHeight),
  }));
}

describe("the mountain board's geometry", () => {
  it("never lets two camp cards overlap, at any width or card height", () => {
    // The fat case is a gated camp: chip, name, meter, a line of explanation
    // and a two-line button. Swept, because content decides the height.
    for (const width of WIDTHS) {
      for (let height = 100; height <= CARD_MAX_H_PX; height += 10) {
        const boxes = boxesAt(width, height);
        for (let i = 0; i < boxes.length; i += 1) {
          for (let j = i + 1; j < boxes.length; j += 1) {
            const a = boxes[i];
            const b = boxes[j];
            if (a === undefined || b === undefined) continue;
            expect(
              overlaps(a.box, b.box),
              `camps ${String(a.camp)} and ${String(b.camp)} overlap at ${String(width)}px, card ${String(height)}px`,
            ).toBe(false);
          }
        }
      }
    }
  });

  it("never lets a card fall off the board", () => {
    for (const width of WIDTHS) {
      for (let height = 100; height <= CARD_MAX_H_PX; height += 10) {
        for (const { camp, box } of boxesAt(width, height)) {
          expect(
            isClipped(box, width),
            `camp ${String(camp)} is clipped at ${String(width)}px, card ${String(height)}px`,
          ).toBe(false);
        }
      }
    }
  });

  it("puts the next range to the right of the summit, on a board wider than its frame", () => {
    expect(BOARD_TOTAL_PX).toBe(BOARD_MIN_PX + EXTENSION_PX);
    expect(EXTENSION_PX).toBeGreaterThan(0);
    const summit = cardBox(CAMP_DEFINITIONS[3].marker, BOARD_MIN_PX, 120);
    for (const camp of UPCOMING_CAMPS) {
      const box = cardBoxIn(camp.marker, extensionArea(BOARD_MIN_PX), 100);
      expect(box.left).toBeGreaterThan(summit.right);
      expect(box.left).toBeGreaterThan(BOARD_MIN_PX);
    }
  });

  it("keeps the coming-soon teasers clear of every camp card, each other, and the edge", () => {
    for (const width of WIDTHS) {
      const area = extensionArea(width);
      const total = area.left + area.width;
      for (let teaser = 60; teaser <= UPCOMING_CARD_MAX_H_PX; teaser += 10) {
        const teasers = UPCOMING_CAMPS.map((camp) => ({
          camp: camp.number,
          box: cardBoxIn(camp.marker, area, teaser),
        }));
        const [five, six] = teasers;
        if (five !== undefined && six !== undefined) {
          expect(overlaps(five.box, six.box), `teasers overlap at ${String(width)}px`).toBe(false);
        }
        for (const { camp, box } of teasers) {
          expect(
            isClipped(box, total, area.height),
            `camp ${String(camp)} teaser is clipped at ${String(width)}px`,
          ).toBe(false);
          for (let height = 100; height <= CARD_MAX_H_PX; height += 10) {
            for (const real of boxesAt(width, height)) {
              expect(
                overlaps(box, real.box),
                `teaser ${String(camp)} overlaps camp ${String(real.camp)} at ${String(width)}px, card ${String(height)}px`,
              ).toBe(false);
            }
          }
        }
      }
    }
  });

  it("sizes the board from its frame, so the mountain exactly fills it on arrival", () => {
    // The whole board is the frame plus the extension; the mountain is the
    // frame's own width, so nothing is clipped before the child scrolls.
    expect(MOUNTAIN_FRACTION * BOARD_SCALE).toBeCloseTo(1, 10);
    expect(BOARD_SCALE).toBeCloseTo(BOARD_TOTAL_PX / BOARD_MIN_PX, 10);
    expect(TOTAL_ASPECT).toBeCloseTo(BOARD_TOTAL_PX / BOARD_H_PX, 10);
    expect(FRAME_MIN_PX).toBeLessThan(BOARD_MIN_PX);
  });

  it("gives the extension the mountain's height, so the two are one picture", () => {
    expect(extensionArea(BOARD_MIN_PX).height).toBe(BOARD_H_PX);
    expect(extensionArea(BOARD_MIN_PX).left).toBe(BOARD_MIN_PX);
  });

  it("grows the top and bottom cards inwards, which is what keeps them on the board", () => {
    expect(cardAnchor(17)).toBe("top");
    expect(cardAnchor(84)).toBe("bottom");
    expect(cardAnchor(40)).toBe("middle");
    expect(cardAnchor(62)).toBe("middle");
  });

  it("anchors a taller card without moving where it starts from", () => {
    const top = CAMP_DEFINITIONS[3].marker;
    expect(cardBox(top, 1152, 120).top).toBe(cardBox(top, 1152, 220).top);
    const bottom = CAMP_DEFINITIONS[0].marker;
    expect(cardBox(bottom, 1152, 120).bottom).toBe(cardBox(bottom, 1152, 220).bottom);
  });

  it("catches the overlap this was written for: a card wide enough to reach its neighbour", () => {
    // Camps 3 and 4 are the tightest pair, 19% apart. The old card was 176px
    // wide and hung the other way, which is exactly what collided.
    const three = cardBox(CAMP_DEFINITIONS[2].marker, BOARD_MIN_PX, 200);
    const four = cardBox(CAMP_DEFINITIONS[3].marker, BOARD_MIN_PX, 200);
    expect(overlaps(three, four)).toBe(false);
    expect(four.left - three.right).toBeGreaterThan(0);
  });
});
