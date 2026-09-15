import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaceValueMat } from "./PlaceValueMat";
import { INTEREST_PALETTES } from "@/lib/theme/interestTheme";
import { EMPTY_PLACE_COUNTS, type GroupingTask, type PlaceCounts } from "@/lib/domain/grouping";

const task: Extract<GroupingTask, { kind: "place-value" }> = {
  kind: "place-value",
  index: 0,
  target: 342,
  unitChoices: [100, 10, 1],
};

const palette = INTEREST_PALETTES.ocean;

function matFor(counts: Partial<PlaceCounts> = {}, locked = false) {
  const onPlace = vi.fn();
  const onRemove = vi.fn();
  const view = render(
    <PlaceValueMat
      task={task}
      counts={{ ...EMPTY_PLACE_COUNTS, ...counts }}
      palette={palette}
      locked={locked}
      onPlace={onPlace}
      onRemove={onRemove}
    />,
  );
  return { ...view, onPlace, onRemove };
}

describe("PlaceValueMat", () => {
  it("gives every offered place a column", () => {
    matFor();
    expect(screen.getByText("Hundreds")).toBeInTheDocument();
    expect(screen.getByText("Tens")).toBeInTheDocument();
    expect(screen.getByText("Ones")).toBeInTheDocument();
    expect(screen.queryByText("Thousands")).not.toBeInTheDocument();
  });

  it("labels each block with its place and its worth", () => {
    matFor();
    expect(
      screen.getByRole("button", { name: "Add one hundred block, worth 100" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add one ten block, worth 10" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add one one block, worth 1" })).toBeInTheDocument();
  });

  it("places a block when tapped", async () => {
    const user = userEvent.setup();
    const { onPlace } = matFor();
    await user.click(screen.getByRole("button", { name: "Add one ten block, worth 10" }));
    expect(onPlace).toHaveBeenCalledWith(10);
  });

  it("makes every block on the mat individually removable", async () => {
    const user = userEvent.setup();
    const { onRemove } = matFor({ 10: 2 });
    const blocks = screen.getAllByRole("button", { name: "Take away one ten block" });
    expect(blocks).toHaveLength(2);
    await user.click(blocks[0] as HTMLElement);
    expect(onRemove).toHaveBeenCalledWith(10);
  });

  it("offers nothing to remove in a place with no blocks in it", () => {
    matFor({ 10: 2 });
    expect(
      screen.queryByRole("button", { name: "Take away one hundred block" }),
    ).not.toBeInTheDocument();
  });

  it("gives every block on the mat a 44px target", () => {
    matFor({ 10: 1, 1: 1 });
    for (const block of screen.getAllByRole("button", { name: /Take away/ })) {
      expect(block).toHaveClass("min-h-11", "min-w-11");
    }
  });

  it("shows the running total against the target", () => {
    const { container } = matFor({ 100: 3, 10: 4, 1: 2 });
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe("On the mat: 342 of 342");
  });

  it("reads an empty mat as zero", () => {
    const { container } = matFor();
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe("On the mat: 0 of 342");
  });

  it("counts the blocks in each column", () => {
    matFor({ 100: 3, 10: 4, 1: 2 });
    const hundreds = screen.getByText("Hundreds").parentElement;
    expect(hundreds).not.toBeNull();
    if (hundreds === null) return;
    expect(hundreds.textContent).toContain("3");
  });

  it("disables the tray once the task is solved", () => {
    matFor({ 100: 3, 10: 4, 1: 2 }, true);
    expect(screen.getByRole("button", { name: "Add one ten block, worth 10" })).toBeDisabled();
  });
});
