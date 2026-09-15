import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Base10Block } from "./Base10Block";
import { PLACE_UNITS, type PlaceUnit } from "@/lib/domain/grouping";

/** The rendered block's own box, in pixels, plus its division gradients. */
function blockOf(unit: PlaceUnit): {
  readonly width: number;
  readonly height: number;
  readonly image: string;
  readonly html: string;
} {
  const { container } = render(<Base10Block unit={unit} color="#a110ff" />);
  const element = container.firstElementChild as HTMLElement | null;
  if (element === null) throw new Error("no block rendered");
  // A thousand is two stacked faces; its own face carries the divisions.
  const nested = element.querySelector("span:last-child");
  const face = nested instanceof HTMLElement ? nested : element;
  return {
    width: Number.parseFloat(element.style.width),
    height: Number.parseFloat(element.style.height),
    image: face.style.backgroundImage,
    html: container.innerHTML,
  };
}

/** One unit cube's size, taken from the smallest block rather than guessed. */
const CELL = blockOf(1).width;

/**
 * How many axes a block is divided along. Counted rather than matched on
 * direction keywords, because jsdom normalises `to bottom` away — it is the
 * CSS default — while keeping `to right`.
 */
function axes(image: string): number {
  return image.split("repeating-linear-gradient").length - 1;
}

describe("Base10Block: true to scale", () => {
  it("draws a one as a single cube", () => {
    const one = blockOf(1);
    expect(one.width).toBe(CELL);
    expect(one.height).toBe(CELL);
    // A single cube needs no divisions — there is nothing to divide.
    expect(one.image).toBe("");
  });

  it("draws a ten as a rod of exactly ten cubes", () => {
    const ten = blockOf(10);
    expect(ten.width).toBe(CELL);
    expect(ten.height).toBe(CELL * 10);
    // Divided along its length only, so a child can count ten.
    expect(axes(ten.image)).toBe(1);
    expect(ten.image).not.toContain("to right");
    expect(ten.image).toContain(`${String(CELL)}px`);
  });

  it("draws a hundred as ten rods by ten, not a token grid", () => {
    const hundred = blockOf(100);
    expect(hundred.width).toBe(CELL * 10);
    expect(hundred.height).toBe(CELL * 10);
    // Divided both ways, at the same one-cube pitch: 10 × 10 = 100 cells.
    expect(axes(hundred.image)).toBe(2);
    expect(hundred.image).toContain("to right");
    expect(hundred.image).toContain(`${String(CELL)}px`);
  });

  it("draws a thousand as a hundred-flat with depth behind it", () => {
    const thousand = blockOf(1000);
    // The box leaves room for the offset second face.
    expect(thousand.width).toBeGreaterThan(CELL * 10);
    expect(axes(thousand.image)).toBe(2);
    expect(thousand.image).toContain("to right");
  });

  it("keeps every block bigger than the one below it", () => {
    const areas = [...PLACE_UNITS]
      .reverse()
      .map((unit) => {
        const block = blockOf(unit);
        return block.width * block.height;
      });
    for (let i = 1; i < areas.length; i += 1) {
      expect(areas[i] ?? 0).toBeGreaterThan(areas[i - 1] ?? 0);
    }
  });
});

describe("Base10Block: appearance", () => {
  it("paints in the theme colour it is given", () => {
    for (const unit of PLACE_UNITS) {
      const { container, unmount } = render(<Base10Block unit={unit} color="#0f8452" />);
      expect(container.innerHTML).toContain("rgb(15, 132, 82)");
      unmount();
    }
  });

  it("is decorative, since the button around it carries the label", () => {
    for (const unit of PLACE_UNITS) {
      const { container, unmount } = render(<Base10Block unit={unit} color="#a110ff" />);
      expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
      unmount();
    }
  });
});
