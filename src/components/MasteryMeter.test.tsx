import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MasteryMeter } from "./MasteryMeter";
import { MASTERY_MAX } from "@/lib/domain/mastery";

describe("MasteryMeter", () => {
  it("reports the meter to assistive technology as a meter", () => {
    render(<MasteryMeter mastery={42} />);
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuenow", "42");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", String(MASTERY_MAX));
  });

  it("shows the reading as a number the child can read", () => {
    render(<MasteryMeter mastery={42} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("says nothing about dimming when nothing has dimmed", () => {
    render(<MasteryMeter mastery={80} earned={80} />);
    expect(screen.queryByText(/▼/)).not.toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-label", "Mastery Meter");
  });

  it("shows how much has dimmed away, in the label and on the bar", () => {
    render(<MasteryMeter mastery={60} earned={100} />);
    expect(screen.getByText("▼40")).toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute(
      "aria-label",
      "Mastery Meter, 60 of 100, dimmed from 100",
    );
  });

  it("treats a missing earned value as no dimming", () => {
    render(<MasteryMeter mastery={35} />);
    expect(screen.queryByText(/▼/)).not.toBeInTheDocument();
  });

  it("ignores an earned value below the shown one, which cannot happen", () => {
    render(<MasteryMeter mastery={70} earned={50} />);
    expect(screen.queryByText(/▼/)).not.toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "70");
  });

  it("clamps a reading off the end of the meter", () => {
    render(<MasteryMeter mastery={-20} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0");
  });

  it("clamps a reading past the top of the meter", () => {
    render(<MasteryMeter mastery={400} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", String(MASTERY_MAX));
  });

  it("rounds a fractional reading rather than showing decimals to a child", () => {
    render(<MasteryMeter mastery={42.6} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "43");
  });

  it("renders at both sizes", () => {
    const { rerender } = render(<MasteryMeter mastery={50} size="sm" />);
    expect(screen.getByRole("meter")).toBeInTheDocument();
    rerender(<MasteryMeter mastery={50} size="lg" />);
    expect(screen.getByRole("meter")).toBeInTheDocument();
  });

  it("always labels itself, at every reading", () => {
    for (const mastery of [0, 1, 50, 99, 100]) {
      const { unmount } = render(<MasteryMeter mastery={mastery} earned={100} />);
      expect(screen.getByRole("meter").getAttribute("aria-label")).toBeTruthy();
      unmount();
    }
  });
});
