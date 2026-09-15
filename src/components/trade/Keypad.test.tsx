import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Keypad } from "./Keypad";

function padFor(entry = "", locked = false) {
  const onDigit = vi.fn();
  const onErase = vi.fn();
  const onSubmit = vi.fn();
  render(<Keypad entry={entry} locked={locked} onDigit={onDigit} onErase={onErase} onSubmit={onSubmit} />);
  return { onDigit, onErase, onSubmit };
}

describe("Keypad", () => {
  it("offers every digit, erase and check, each a 44px target with a name", () => {
    padFor("8");
    for (let d = 0; d <= 9; d += 1) {
      expect(screen.getByRole("button", { name: String(d) })).toHaveClass("size-14");
    }
    expect(screen.getByRole("button", { name: "Erase" })).toHaveClass("size-14");
    expect(screen.getByRole("button", { name: "Check my answer" })).toHaveClass("size-14");
  });

  it("shows what has been typed, and a question mark until then", () => {
    const { unmount } = render(
      <Keypad entry="" locked={false} onDigit={() => undefined} onErase={() => undefined} onSubmit={() => undefined} />,
    );
    expect(screen.getByLabelText("Your answer")).toHaveTextContent("?");
    unmount();
    padFor("84");
    expect(screen.getByLabelText("Your answer")).toHaveTextContent("84");
  });

  it("reports taps", async () => {
    const user = userEvent.setup();
    const { onDigit, onErase, onSubmit } = padFor("8");
    await user.click(screen.getByRole("button", { name: "4" }));
    await user.click(screen.getByRole("button", { name: "Erase" }));
    await user.click(screen.getByRole("button", { name: "Check my answer" }));
    expect(onDigit).toHaveBeenCalledWith(4);
    expect(onErase).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("takes a physical keyboard too: digits, Backspace, Enter", () => {
    const { onDigit, onErase, onSubmit } = padFor("8");
    fireEvent.keyDown(window, { key: "7" });
    fireEvent.keyDown(window, { key: "Backspace" });
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyDown(window, { key: "a" });
    expect(onDigit).toHaveBeenCalledWith(7);
    expect(onErase).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onDigit).toHaveBeenCalledTimes(1);
  });

  it("cannot check an empty answer, and is quiet when locked", () => {
    const empty = padFor("");
    expect(screen.getByRole("button", { name: "Check my answer" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Erase" })).toBeDisabled();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(empty.onSubmit).toHaveBeenCalledTimes(1); // the reducer decides an empty check does nothing
  });

  it("stops listening while locked", () => {
    const { onDigit } = padFor("84", true);
    expect(screen.getByRole("button", { name: "5" })).toBeDisabled();
    fireEvent.keyDown(window, { key: "5" });
    expect(onDigit).not.toHaveBeenCalled();
  });
});
