import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PickTheJumpCamp } from "./PickTheJumpCamp";
import { generateJumpProblem } from "@/lib/math/numberLineProblems";
import { jumpChoices, JUMP_CHOICES } from "@/lib/math/jumpChoices";
import { STARTING_DIFFICULTY } from "@/lib/domain/difficulty";
import { NO_PROGRESS } from "@/lib/domain/progress";
import { MASTERY_MAX, masteryGain } from "@/lib/domain/mastery";
import { CAMP_DEFINITIONS } from "@/lib/data/camps";
import { localDateSchema } from "@/lib/domain/localDate";
import type { ClimberProfile } from "@/lib/domain/onboarding";
import type { ClimbContext } from "@/lib/domain/milestones";
import { urlOf } from "@test/requests";

const fetchMock = vi.fn<typeof fetch>();

const CLIMB: ClimbContext = {
  days: [],
  checkpointsPassed: 0,
  serverToday: localDateSchema.parse("2020-01-01"),
};

const PROFILE: ClimberProfile = { gradeBand: "2-3", interestTheme: "space" };
const PINE_RIDGE = CAMP_DEFINITIONS[1];

function screenFor(startingMastery = 0) {
  return render(
    <PickTheJumpCamp
      camp={PINE_RIDGE}
      skill="cross-place"
      profile={PROFILE}
      startingMastery={startingMastery}
      progressAtStart={NO_PROGRESS}
      climb={CLIMB}
    />,
  );
}

/** The problem the screen opens on, and the board it offers for it. */
function firstBoard() {
  const problem = generateJumpProblem("cross-place", PROFILE.gradeBand, STARTING_DIFFICULTY, 0);
  return { problem, choices: jumpChoices(problem, PROFILE.gradeBand) };
}

function landing(value: number): HTMLElement {
  return screen.getByRole("button", { name: `Lands on ${String(value)}` });
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url) => {
    if (urlOf(url) === "/api/coach") {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            want: "framing",
            framing: { story: "A story.", question: "A question?", source: "template" },
          }),
          { status: 200 },
        ),
      );
    }
    return Promise.resolve(new Response(JSON.stringify({ saved: true }), { status: 200 }));
  });
  vi.stubGlobal("fetch", fetchMock);
});

describe("PickTheJumpCamp: the board", () => {
  it("names the camp and what it practises", () => {
    screenFor();
    expect(screen.getByRole("heading", { name: "Pick the landing" })).toBeInTheDocument();
    expect(screen.getByText(/Camp 2 · Pine Ridge/)).toBeInTheDocument();
  });

  it("shows the jump and four landings to choose from, the answer among them", () => {
    const { problem, choices } = firstBoard();
    screenFor();

    const sign = problem.operation === "add" ? "\\+" : "−";
    expect(
      screen.getByText(new RegExp(`${String(problem.start)} ${sign} ${String(problem.change)}`)),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Lands on/ })).toHaveLength(JUMP_CHOICES);
    expect(landing(problem.answer)).toBeInTheDocument();
    for (const choice of choices) expect(landing(choice)).toBeInTheDocument();
  });

  it("gives every landing a tap target well over 44px", () => {
    screenFor();
    for (const button of screen.getAllByRole("button", { name: /^Lands on/ })) {
      expect(button).toHaveClass("min-h-20");
    }
  });
});

describe("PickTheJumpCamp: answering", () => {
  it("pays the meter first time and offers the next one", async () => {
    const user = userEvent.setup();
    const { problem } = firstBoard();
    screenFor();

    await user.click(landing(problem.answer));

    expect(await screen.findByText(new RegExp(`\\+${String(masteryGain(0))} mastery`))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next one" })).toBeInTheDocument();
    // The chosen landing is locked in and shown as the answer.
    expect(landing(problem.answer)).toBeDisabled();
  });

  it("writes the solve through to the server", async () => {
    const user = userEvent.setup();
    const { problem } = firstBoard();
    screenFor();

    await user.click(landing(problem.answer));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => urlOf(url) === "/api/learner")).toBe(true);
    });
  });

  it("answers a wrong landing with a nudge and another go, then pays less", async () => {
    const user = userEvent.setup();
    const { problem, choices } = firstBoard();
    screenFor();

    const wrong = choices.find((choice) => choice !== problem.answer);
    expect(wrong).toBeDefined();
    if (wrong === undefined) return;

    await user.click(landing(wrong));
    const again = await screen.findByRole("button", { name: "Have another go" });
    // A wrong pick never shows the answer, a cross, or a red.
    expect(screen.queryByText(/wrong|incorrect|✗/i)).not.toBeInTheDocument();

    await user.click(again);
    await user.click(landing(problem.answer));

    expect(
      await screen.findByText(new RegExp(`\\+${String(masteryGain(1))} mastery`)),
    ).toBeInTheDocument();
  });

  it("hands over a fresh problem on the next one", async () => {
    const user = userEvent.setup();
    const { problem } = firstBoard();
    screenFor();

    await user.click(landing(problem.answer));
    await user.click(await screen.findByRole("button", { name: "Next one" }));

    // The outcome, not the old panel's disappearance — AnimatePresence keeps it.
    expect(screen.getByText(/Problem 2 · 1 solved/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Lands on/ })).toHaveLength(JUMP_CHOICES);
  });

  it("celebrates a full meter and still lets the child keep practising", async () => {
    const user = userEvent.setup();
    const { problem } = firstBoard();
    screenFor(MASTERY_MAX);

    await user.click(landing(problem.answer));

    expect(screen.queryByRole("button", { name: "Next one" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep practising" }));
    expect(screen.getByRole("heading", { name: "Pick the landing" })).toBeInTheDocument();
  });
});

describe("PickTheJumpCamp: finishing", () => {
  it("swaps the board for the summary", async () => {
    const user = userEvent.setup();
    screenFor();

    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(screen.queryByText(/Which one does the jump land on/)).not.toBeInTheDocument();
    expect(screen.getByText("Session complete")).toBeInTheDocument();
  });
});
