import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArrayFrame } from "./ArrayFrame";
import { INTEREST_PALETTES } from "@/lib/theme/interestTheme";
import type { GroupingTask } from "@/lib/domain/grouping";

const task: Extract<GroupingTask, { kind: "array" }> = {
  kind: "array",
  index: 0,
  rows: 3,
  cols: 4,
  stripChoices: [3, 4, 5],
};

const palette = INTEREST_PALETTES.jungle;

function frameFor(strips: readonly number[], locked = false) {
  const onPlace = vi.fn<(length: number) => void>();
  const onRemove = vi.fn<(at: number) => void>();
  const view = render(
    <ArrayFrame
      task={task}
      strips={strips}
      palette={palette}
      locked={locked}
      onPlace={onPlace}
      onRemove={onRemove}
    />,
  );
  return { ...view, onPlace, onRemove };
}

describe("ArrayFrame: an empty frame", () => {
  it("says what to do", () => {
    frameFor([]);
    expect(screen.getByText("Drag a row of tiles in here")).toBeInTheDocument();
  });

  it("states the target", () => {
    frameFor([]);
    expect(screen.getByText("Target: 3 rows of 4")).toBeInTheDocument();
  });

  it("offers every strip on the tray as a labelled control", () => {
    frameFor([]);
    for (const length of task.stripChoices) {
      expect(
        screen.getByRole("button", { name: `Add a row of ${String(length)}` }),
      ).toBeInTheDocument();
    }
  });

  it("offers nothing to take off yet", () => {
    frameFor([]);
    expect(screen.queryByRole("button", { name: /Take off/ })).not.toBeInTheDocument();
  });
});

describe("ArrayFrame: building", () => {
  it("places a row when a strip is tapped", async () => {
    const user = userEvent.setup();
    const { onPlace } = frameFor([]);
    await user.click(screen.getByRole("button", { name: "Add a row of 4" }));
    expect(onPlace).toHaveBeenCalledWith(4);
  });

  it("counts the rows and the tiles as they go in", () => {
    frameFor([4, 4]);
    expect(screen.getByText("2 rows · 8 tiles")).toBeInTheDocument();
  });

  it("uses the singular for one row", () => {
    frameFor([4]);
    expect(screen.getByText("1 row · 4 tiles")).toBeInTheDocument();
  });

  it("announces the count politely as it changes", () => {
    const { container } = frameFor([4]);
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe("1 row · 4 tiles");
  });

  it("takes the last row back off", async () => {
    const user = userEvent.setup();
    const { onRemove } = frameFor([4, 4]);
    await user.click(screen.getByRole("button", { name: "Take off the last row" }));
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("gives the take-off control a 44px target", () => {
    frameFor([4]);
    expect(screen.getByRole("button", { name: "Take off the last row" })).toHaveClass("min-h-11");
  });
});

describe("ArrayFrame: once solved", () => {
  it("stops offering to change the array", () => {
    frameFor([4, 4, 4], true);
    expect(screen.queryByRole("button", { name: /Take off/ })).not.toBeInTheDocument();
  });

  it("disables the tray", () => {
    frameFor([4, 4, 4], true);
    for (const length of task.stripChoices) {
      expect(screen.getByRole("button", { name: `Add a row of ${String(length)}` })).toBeDisabled();
    }
  });
});

describe("ArrayFrame: a drag cannot grow the page", () => {
  /*
   * An unconstrained drag is what reliably returns a piece to the tray, but a
   * transform counts towards the document's scrollable overflow — so the page
   * is locked while a piece is in the air instead. Constraining the drag is
   * what used to strand pieces at the constraint edge.
   */
  const at = (x: number, y: number) => ({
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true, // Framer ignores a pointer event without it.
    buttons: 1,
    clientX: x,
    clientY: y,
    pageX: x,
    pageY: y,
  });
  const frame = () => new Promise((resolve) => { requestAnimationFrame(() => { resolve(null); }); });

  it("locks the root while a piece is in the air, and restores it afterwards", async () => {
    frameFor([]);
    expect(document.documentElement.style.overflow).toBe("");

    const piece = screen.getByRole("button", { name: "Add a row of 4" });
    fireEvent.pointerDown(piece, at(0, 0));
    await frame();
    for (const step of [0.3, 0.7, 1]) {
      fireEvent.pointerMove(window, at(180 * step, 140 * step));
      await frame();
    }
    await waitFor(() => { expect(document.documentElement.style.overflow).toBe("hidden"); });

    fireEvent.pointerUp(window, at(180, 140));
    await frame();
    await waitFor(() => { expect(document.documentElement.style.overflow).toBe(""); });
  });

  it("leaves the page alone when nothing is being dragged", () => {
    frameFor([2, 2]);
    expect(document.documentElement.style.overflow).toBe("");
  });
});
