import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PieceGrid, TradeMat } from "./TradeMat";
import { TRADE_AT } from "@/lib/domain/grouping";
import { INTEREST_PALETTES } from "@/lib/theme/interestTheme";
import type { TradeTask } from "@/lib/math/tradeTasks";

const palette = INTEREST_PALETTES.ocean;

function grid(held: number, tradable = true, unit: 1 | 10 | 100 | 1000 = 1) {
  const { container } = render(<PieceGrid unit={unit} held={held} tradable={tradable} palette={palette} />);
  return {
    pieces: container.querySelectorAll("[data-piece]").length,
    fullFrames: container.querySelectorAll("[data-full-frame]").length,
    svg: container.querySelector("svg"),
  };
}

describe("PieceGrid: the pieces a place holds", () => {
  it("draws one piece per thing held, for every count a mat can start with", () => {
    for (let held = 0; held <= 29; held += 1) {
      expect(grid(held).pieces).toBe(held);
    }
  });

  it("rings each full ten as one trade, and only where the place can trade", () => {
    expect(grid(9).fullFrames).toBe(0);
    expect(grid(TRADE_AT).fullFrames).toBe(1);
    expect(grid(14).fullFrames).toBe(1);
    expect(grid(2 * TRADE_AT + 3).fullFrames).toBe(2);
    // The top place has nothing to trade into, so its tens are just tens.
    expect(grid(14, false).fullFrames).toBe(0);
  });

  it("shows an empty frame for an empty place, so the space still reads", () => {
    const { container } = render(<PieceGrid unit={10} held={0} tradable palette={palette} />);
    expect(container.querySelectorAll("rect").length).toBe(1);
    expect(container.querySelectorAll("[data-piece]").length).toBe(0);
  });

  it("is decoration: the count beside it carries the number", () => {
    expect(grid(7).svg).toHaveAttribute("aria-hidden");
  });

  it("draws every place in its own colour and shape", () => {
    for (const unit of [1, 10, 100, 1000] as const) {
      const { container } = render(<PieceGrid unit={unit} held={3} tradable palette={palette} />);
      expect(container.innerHTML).toContain(palette.piece);
      expect(container.querySelectorAll("[data-piece]").length).toBe(3);
    }
  });
});

describe("TradeMat: the question, drawn", () => {
  const task: TradeTask = {
    index: 0,
    target: 84,
    units: [10, 1],
    start: { 1000: 0, 100: 0, 10: 7, 1: 14 },
  };

  it("offers nothing to press: the answer is typed, not tapped", () => {
    render(<TradeMat task={task} palette={palette} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    // The value is nowhere on the mat, because it is the answer.
    expect(screen.queryByText("84")).not.toBeInTheDocument();
    expect(screen.getByText("Tens")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
  });

  it("draws what each column holds", () => {
    const { container } = render(<TradeMat task={task} palette={palette} />);
    const grids = container.querySelectorAll("[data-piece-grid]");
    expect(grids.length).toBe(2);
    expect(grids[0]?.querySelectorAll("[data-piece]").length).toBe(7);
    expect(grids[1]?.querySelectorAll("[data-piece]").length).toBe(14);
    // Fourteen ones: one ringed ten and four spare.
    expect(grids[1]?.querySelectorAll("[data-full-frame]").length).toBe(1);
  });
});
