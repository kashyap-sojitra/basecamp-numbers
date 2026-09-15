import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppBar } from "./AppBar";

describe("AppBar", () => {
  it("names the app", () => {
    render(<AppBar current="map" />);

    expect(screen.getByText("Basecamp Numbers")).toBeInTheDocument();
  });

  it("offers progress and the picks, but not a link to the page you are on", () => {
    render(<AppBar current="map" />);

    expect(screen.getByRole("link", { name: "My progress" })).toHaveAttribute("href", "/log");
    expect(screen.getByRole("link", { name: "Grade & world" })).toHaveAttribute(
      "href",
      "/?change=1",
    );
    expect(screen.queryByRole("link", { name: "Map" })).not.toBeInTheDocument();
  });

  it("marks the current page for a screen reader", () => {
    render(<AppBar current="log" />);

    expect(screen.getByText("My progress").closest("[aria-current]")).toHaveAttribute(
      "aria-current",
      "page",
    );
    // ...and the way back to the mountain is a real link again.
    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map");
  });

  it("names the destinations as words, so the glyphs are decoration", () => {
    render(<AppBar current="map" />);

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav).toBeInTheDocument();
    // Every glyph is hidden from the accessible tree.
    for (const glyph of ["🗺️", "🏅", "⚙️"]) {
      expect(screen.getByText(glyph)).toHaveAttribute("aria-hidden");
    }
  });

  it("gives every destination a 44px tap target", () => {
    render(<AppBar current="map" />);

    for (const name of ["My progress", "Grade & world"]) {
      expect(screen.getByRole("link", { name })).toHaveClass("min-h-11");
    }
  });
  it("offers all three on a camp, where none of them is the current page", () => {
    render(<AppBar current="none" />);

    for (const [name, href] of [
      ["Map", "/map"],
      ["My progress", "/log"],
      ["Grade & world", "/?change=1"],
    ] as const) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    expect(document.querySelector('[aria-current="page"]')).toBeNull();
  });

  it("marks the picks as current when onboarding is reopened", () => {
    render(<AppBar current="picks" />);

    expect(screen.getByText("Grade & world").closest("[aria-current]")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map");
  });

  it("keeps its identity but drops the pills for a first-time climber", () => {
    // Nothing is saved yet, so /map and /log would bounce straight back here.
    render(<AppBar current="picks" destinations={false} />);

    expect(screen.getByText("Basecamp Numbers")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });
});
