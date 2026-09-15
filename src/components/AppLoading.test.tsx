import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppLoading } from "./AppLoading";

describe("AppLoading", () => {
  it("says what is being waited for", () => {
    render(<AppLoading label="Finding your mountain…" />);
    expect(screen.getByText("Finding your mountain…")).toBeInTheDocument();
  });

  it("is a main region, so the page is never structurally empty mid-load", () => {
    render(<AppLoading label="Loading" />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("keeps the climber and the rope decorative", () => {
    const { container } = render(<AppLoading label="Loading" />);
    const decorations = container.querySelectorAll('[aria-hidden="true"]');
    expect(decorations.length).toBeGreaterThan(0);
  });
});
