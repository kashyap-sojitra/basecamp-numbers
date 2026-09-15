import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ButtonSpinner } from "./ButtonSpinner";

describe("ButtonSpinner", () => {
  it("renders a decorative spinner, hidden from assistive technology", () => {
    const { container } = render(<ButtonSpinner />);
    const spinner = container.firstElementChild;
    expect(spinner).not.toBeNull();
    // The button's own label says what is happening; the spinner is decoration.
    expect(spinner).toHaveAttribute("aria-hidden", "true");
  });

  it("carries no text of its own", () => {
    const { container } = render(<ButtonSpinner />);
    expect(container.textContent).toBe("");
  });
});
