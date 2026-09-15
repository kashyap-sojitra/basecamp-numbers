import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnswerBurst } from "./AnswerBurst";
import { MISS_WORDS, YAY, type MissTone, type Reaction } from "@/lib/domain/reaction";

const miss = (tone: MissTone): Reaction => ({ kind: "miss", tone });

describe("AnswerBurst", () => {
  it("shows nothing before an answer has been given", () => {
    const { container } = render(<AnswerBurst reaction={YAY} fireKey={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("stamps YAY for a right answer", () => {
    render(<AnswerBurst reaction={YAY} fireKey={1} />);
    expect(screen.getByText("YAY!")).toBeInTheDocument();
  });

  it("stamps how far off a wrong one was, in the rule's own words", () => {
    for (const tone of ["close", "off", "far", "too-many", "not-yet"] as const) {
      const { unmount } = render(<AnswerBurst reaction={miss(tone)} fireKey={1} />);
      expect(screen.getByText(MISS_WORDS[tone])).toBeInTheDocument();
      unmount();
    }
  });

  it("never says nearly when the landing was not near", () => {
    render(<AnswerBurst reaction={miss("far")} fireKey={1} />);
    expect(screen.queryByText(/nearly/i)).not.toBeInTheDocument();
  });

  it("never shows a cross, a red or a sad face", () => {
    for (const tone of ["close", "off", "far", "too-many", "not-yet"] as const) {
      const { container, unmount } = render(<AnswerBurst reaction={miss(tone)} fireKey={3} />);
      const { textContent: text } = container;
      for (const unkind of ["❌", "✖", "✗", "😢", "😞", "👎"]) {
        expect(text).not.toContain(unkind);
      }
      expect(text).not.toMatch(/\b(wrong|no)\b/i);
      unmount();
    }
  });

  it("is decorative, so it is hidden from assistive technology", () => {
    const { container } = render(<AnswerBurst reaction={YAY} fireKey={1} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("cannot catch a tap meant for the button underneath", () => {
    const { container } = render(<AnswerBurst reaction={YAY} fireKey={1} />);
    expect(container.firstElementChild).toHaveClass("pointer-events-none");
  });

  it("throws more emoji at a win than at a wobble", () => {
    const yay = render(<AnswerBurst reaction={YAY} fireKey={1} />);
    const yayCount = yay.container.querySelectorAll("span.text-2xl").length;
    yay.unmount();
    const nearly = render(<AnswerBurst reaction={miss("off")} fireKey={1} />);
    const nearlyCount = nearly.container.querySelectorAll("span.text-2xl").length;
    expect(yayCount).toBeGreaterThan(nearlyCount);
  });

  it("is a pure function of its fire key, so a re-render never reshuffles", () => {
    const first = render(<AnswerBurst reaction={YAY} fireKey={7} />);
    const emoji = first.container.textContent;
    first.unmount();
    const second = render(<AnswerBurst reaction={YAY} fireKey={7} />);
    expect(second.container.textContent).toBe(emoji);
  });

  it("throws a different burst for a different answer", () => {
    const first = render(<AnswerBurst reaction={YAY} fireKey={1} />);
    const one = first.container.textContent;
    first.unmount();
    const second = render(<AnswerBurst reaction={YAY} fireKey={2} />);
    expect(second.container.textContent).not.toBe(one);
  });

  it("fires again when the key changes", () => {
    const { rerender } = render(<AnswerBurst reaction={YAY} fireKey={1} />);
    rerender(<AnswerBurst reaction={YAY} fireKey={2} />);
    expect(screen.getByText("YAY!")).toBeInTheDocument();
  });
});
