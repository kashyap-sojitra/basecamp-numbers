import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { DraggablePiece, landedInZone } from "./DraggablePiece";

/** Renders a piece over a drop zone, as the frames do. */
function Harness({
  onDrop,
  disabled = false,
  onDragActive = () => undefined,
}: {
  readonly onDrop: () => void;
  readonly disabled?: boolean;
  readonly onDragActive?: (active: boolean) => void;
}) {
  const zone = useRef<HTMLDivElement>(null);
  return (
    <div>
      <div ref={zone} data-testid="zone" />
      <DraggablePiece
        dropZone={zone}
        onDrop={onDrop}
        disabled={disabled}
        label="Add a row of 4"
        onDragActive={onDragActive}
      >
        <span>tiles</span>
      </DraggablePiece>
    </div>
  );
}

describe("DraggablePiece", () => {
  it("is a real labelled button, so it works without dragging at all", () => {
    render(<Harness onDrop={vi.fn()} />);
    const piece = screen.getByRole("button", { name: "Add a row of 4" });
    expect(piece).toBeEnabled();
  });

  it("places the piece when tapped", async () => {
    const user = userEvent.setup();
    const onDrop = vi.fn();
    render(<Harness onDrop={onDrop} />);
    await user.click(screen.getByRole("button", { name: "Add a row of 4" }));
    expect(onDrop).toHaveBeenCalledTimes(1);
  });

  it("places the piece from the keyboard", async () => {
    const user = userEvent.setup();
    const onDrop = vi.fn();
    render(<Harness onDrop={onDrop} />);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onDrop).toHaveBeenCalledTimes(1);
  });

  it("shows its contents", () => {
    render(<Harness onDrop={vi.fn()} />);
    expect(screen.getByText("tiles")).toBeInTheDocument();
  });

  it("does nothing at all when disabled", async () => {
    const user = userEvent.setup();
    const onDrop = vi.fn();
    render(<Harness onDrop={onDrop} disabled />);
    const piece = screen.getByRole("button", { name: "Add a row of 4" });
    expect(piece).toBeDisabled();
    await user.click(piece);
    expect(onDrop).not.toHaveBeenCalled();
  });
});

describe("landedInZone", () => {
  const zone = { left: 100, right: 300, top: 50, bottom: 200 };
  const noScroll = { x: 0, y: 0 };

  it("accepts a drop in the middle of the zone", () => {
    expect(landedInZone({ x: 200, y: 120 }, zone, noScroll)).toBe(true);
  });

  it("accepts a drop exactly on the edge, which a child will manage often", () => {
    for (const point of [
      { x: 100, y: 50 },
      { x: 300, y: 200 },
      { x: 100, y: 200 },
      { x: 300, y: 50 },
    ]) {
      expect(landedInZone(point, zone, noScroll)).toBe(true);
    }
  });

  it("refuses a drop outside on any side", () => {
    for (const point of [
      { x: 99, y: 120 },
      { x: 301, y: 120 },
      { x: 200, y: 49 },
      { x: 200, y: 201 },
    ]) {
      expect(landedInZone(point, zone, noScroll)).toBe(false);
    }
  });

  it("corrects for page scroll, so a drop still lands on a scrolled page", () => {
    // The zone is at viewport y 50-200; the page is scrolled 400px, so the
    // same visual spot is page y 450-600.
    const scroll = { x: 0, y: 400 };
    expect(landedInZone({ x: 200, y: 520 }, zone, scroll)).toBe(true);
    // ...and the unscrolled coordinate now misses, which is the bug this
    // correction exists to prevent.
    expect(landedInZone({ x: 200, y: 120 }, zone, scroll)).toBe(false);
  });

  it("corrects for horizontal scroll too, which the number line can cause", () => {
    expect(landedInZone({ x: 700, y: 120 }, zone, { x: 500, y: 0 })).toBe(true);
  });

  it("treats a zero-sized zone as unreachable except at its point", () => {
    const point = { left: 10, right: 10, top: 10, bottom: 10 };
    expect(landedInZone({ x: 10, y: 10 }, point, noScroll)).toBe(true);
    expect(landedInZone({ x: 11, y: 10 }, point, noScroll)).toBe(false);
  });
});

describe("DraggablePiece: dragging", () => {
  /**
   * A drag: press, move far enough for Framer to call it a drag, release.
   *
   * `isPrimary` matters — Framer ignores any pointer event without it, so a
   * drag simulated without it silently does nothing. `pageX`/`pageY` matter
   * too: Framer reports those as `info.point`, which is what the drop test
   * reads.
   */
  async function drag(piece: HTMLElement, to: { x: number; y: number }): Promise<void> {
    const frame = () => new Promise((resolve) => { requestAnimationFrame(() => { resolve(null); }); });
    const at = (x: number, y: number) => ({
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      buttons: 1,
      clientX: x,
      clientY: y,
      pageX: x,
      pageY: y,
    });

    fireEvent.pointerDown(piece, at(0, 0));
    await frame();
    for (const fraction of [0.2, 0.6, 1]) {
      fireEvent.pointerMove(window, at(to.x * fraction, to.y * fraction));
      await frame();
    }
    fireEvent.pointerUp(window, at(to.x, to.y));
    await frame();
  }

  /** The drop zone's box, which jsdom will not lay out on its own. */
  function zoneAt(rect: { left: number; top: number; right: number; bottom: number }): void {
    const box: DOMRect = {
      ...rect,
      width: rect.right - rect.left,
      height: rect.bottom - rect.top,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    };
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(box);
  }

  it("lights the zone up while a piece is in the air, and lets go after", async () => {
    const onDragActive = vi.fn<(active: boolean) => void>();
    zoneAt({ left: 0, top: 0, right: 500, bottom: 500 });
    render(<Harness onDrop={vi.fn()} onDragActive={onDragActive} />);
    await drag(screen.getByRole("button", { name: "Add a row of 4" }), { x: 200, y: 200 });
    expect(onDragActive).toHaveBeenCalledWith(true);
    expect(onDragActive).toHaveBeenLastCalledWith(false);
  });

  it("places the piece when it is released over the zone", async () => {
    const onDrop = vi.fn();
    zoneAt({ left: 0, top: 0, right: 500, bottom: 500 });
    render(<Harness onDrop={onDrop} />);
    await drag(screen.getByRole("button", { name: "Add a row of 4" }), { x: 200, y: 200 });
    expect(onDrop).toHaveBeenCalledTimes(1);
  });

  it("does not place the piece when it is dropped outside the zone", async () => {
    const onDrop = vi.fn();
    zoneAt({ left: 0, top: 0, right: 50, bottom: 50 });
    render(<Harness onDrop={onDrop} />);
    await drag(screen.getByRole("button", { name: "Add a row of 4" }), { x: 400, y: 400 });
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("counts a drag as one placement, not a drag plus the click after it", async () => {
    const onDrop = vi.fn();
    zoneAt({ left: 0, top: 0, right: 500, bottom: 500 });
    render(<Harness onDrop={onDrop} />);
    const piece = screen.getByRole("button", { name: "Add a row of 4" });
    await drag(piece, { x: 200, y: 200 });
    fireEvent.click(piece);
    expect(onDrop).toHaveBeenCalledTimes(1);
  });
});
