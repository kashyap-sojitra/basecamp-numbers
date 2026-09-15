import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { StreakFlame } from "./StreakFlame";
import { streakFrom, type ClimbDay } from "@/lib/domain/streak";
import { localDateSchema, type LocalDate } from "@/lib/domain/localDate";

const TODAY: LocalDate = localDateSchema.parse("2026-09-11");
const day = (date: string): ClimbDay => ({
  date: localDateSchema.parse(date),
  band: "2-3", camp: 1,
  solves: 3,
  cleanSolves: 3,
});

describe("StreakFlame", () => {
  it("burns for a live streak", () => {
    const { container } = render(<StreakFlame view={streakFrom([day("2026-09-11")], TODAY)} />);
    expect(container.textContent).toBe("🔥");
  });

  it("shows a candle, not a crossed-out flame, when the streak is resting", () => {
    const resting = streakFrom([day("2026-09-01")], TODAY);
    const { container } = render(<StreakFlame view={resting} />);
    expect(container.textContent).toBe("🕯️");
    expect(container.textContent).not.toContain("❌");
  });

  it("dims a resting streak rather than hiding it", () => {
    const resting = streakFrom([day("2026-09-01")], TODAY);
    const { container } = render(<StreakFlame view={resting} />);
    expect(container.firstElementChild?.className).toContain("opacity-45");
  });

  it("shows a candle before a streak has ever started", () => {
    const { container } = render(<StreakFlame view={streakFrom([], TODAY)} />);
    expect(container.textContent).toBe("🕯️");
  });

  it("is decorative, since the chip beside it carries the words", () => {
    const { container } = render(<StreakFlame view={streakFrom([day("2026-09-11")], TODAY)} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("takes a size from its caller", () => {
    const { container } = render(
      <StreakFlame view={streakFrom([day("2026-09-11")], TODAY)} size="text-base" />,
    );
    expect(container.firstElementChild?.className).toContain("text-base");
  });
});
