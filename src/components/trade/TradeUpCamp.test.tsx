import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TradeUpCamp } from "./TradeUpCamp";
import { generateTradeTask } from "@/lib/math/tradeTasks";
import { STARTING_DIFFICULTY } from "@/lib/domain/difficulty";
import { NO_PROGRESS } from "@/lib/domain/progress";
import { masteryGain, MASTERY_MAX } from "@/lib/domain/mastery";
import { CAMP_DEFINITIONS } from "@/lib/data/camps";
import { localDateSchema } from "@/lib/domain/localDate";
import type { ClimberProfile } from "@/lib/domain/onboarding";
import type { ClimbContext } from "@/lib/domain/milestones";
import { urlOf } from "@test/requests";
import { matReading, tradeHint, tradeQuestion } from "@/lib/domain/tradeCopy";
import { reactionWord, tradeMiss } from "@/lib/domain/reaction";

const fetchMock = vi.fn<typeof fetch>();

const CLIMB: ClimbContext = {
  days: [],
  checkpointsPassed: 0,
  serverToday: localDateSchema.parse("2020-01-01"),
};

const PROFILE: ClimberProfile = { gradeBand: "2-3", interestTheme: "jungle" };
const SUMMIT = CAMP_DEFINITIONS[3];

function screenFor(startingMastery = 0) {
  return render(
    <TradeUpCamp
      camp={SUMMIT}
      profile={PROFILE}
      startingMastery={startingMastery}
      progressAtStart={NO_PROGRESS}
      climb={CLIMB}
    />,
  );
}

/** The task the screen opens on, so a test knows the number to type. */
function firstTask() {
  return generateTradeTask(PROFILE.gradeBand, STARTING_DIFFICULTY, 0);
}

/** Type a number on the keypad and check it. */
async function typeAnswer(user: ReturnType<typeof userEvent.setup>, value: number) {
  for (const digit of String(value)) {
    await user.click(screen.getByRole("button", { name: digit }));
  }
  await user.click(screen.getByRole("button", { name: "Check my answer" }));
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

describe("TradeUpCamp: the board", () => {
  it("names the camp and what it practises", () => {
    screenFor();
    expect(screen.getByRole("heading", { name: "Name the number" })).toBeInTheDocument();
    expect(screen.getByText(/Camp 4 · The Summit/)).toBeInTheDocument();
  });

  it("asks the question and never shows the answer before it is found", () => {
    const task = firstTask();
    screenFor();
    expect(screen.getByRole("heading", { name: tradeQuestion(PROFILE.gradeBand) })).toBeInTheDocument();
    // The value is the answer: not on the mat, not in the words, not anywhere.
    expect(screen.queryByText(String(task.target))).not.toBeInTheDocument();
    expect(screen.getByLabelText("Your answer")).toHaveTextContent("?");
  });

  it("offers nothing on the mat to tap: the only controls are the keypad", () => {
    screenFor();
    const names = screen
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label") ?? b.textContent);
    expect(names.some((name) => /Trade/.test(name))).toBe(false);
    expect(screen.getByRole("button", { name: "Check my answer" })).toHaveClass("size-14");
  });
});

describe("TradeUpCamp: answering", () => {
  it("pays the meter, reads the mat back as a sum, and offers the next one", async () => {
    const user = userEvent.setup();
    const task = firstTask();
    screenFor();

    await typeAnswer(user, task.target);

    const done = matReading(PROFILE.gradeBand, task.start, task.units, task.target);
    expect(
      await screen.findByText(
        (_, element) => element instanceof HTMLParagraphElement && element.textContent.startsWith(done),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`\\+${String(masteryGain(0))} mastery`))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next one" })).toBeInTheDocument();
    expect(screen.getByText(reactionWord({ kind: "yay" }))).toBeInTheDocument();
  });

  it("records the solve through to the server", async () => {
    const user = userEvent.setup();
    const task = firstTask();
    screenFor();

    await typeAnswer(user, task.target);

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => urlOf(url) === "/api/learner")).toBe(true);
    });
  });

  it("diagnoses a wrong number, says how far off it was, and lets the child try again", async () => {
    const user = userEvent.setup();
    const task = firstTask();
    screenFor();

    // The classic slip: the counts written side by side.
    const glued = Number(task.units.map((unit) => String(task.start[unit])).join(""));
    await typeAnswer(user, glued);

    expect(screen.getByText(tradeHint(PROFILE.gradeBand, "places-side-by-side"))).toBeInTheDocument();
    expect(screen.getByText(reactionWord(tradeMiss(glued, task.target)))).toBeInTheDocument();
    // The entry is cleared, and the keypad waits until the hint is dismissed.
    expect(screen.getByLabelText("Your answer")).toHaveTextContent("?");
    expect(screen.getByRole("button", { name: "5" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("button", { name: "5" })).toBeEnabled();

    // Found after a wobble: still a win, paid less.
    await typeAnswer(user, task.target);
    expect(
      await screen.findByText(new RegExp(`\\+${String(masteryGain(1))} mastery`)),
    ).toBeInTheDocument();
  });
});

describe("TradeUpCamp: finishing", () => {
  it("swaps the board for the summary when the child finishes", async () => {
    const user = userEvent.setup();
    screenFor();

    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(screen.queryByRole("heading", { name: tradeQuestion(PROFILE.gradeBand) })).not.toBeInTheDocument();
    expect(screen.getByText("Session complete")).toBeInTheDocument();
  });
});

describe("TradeUpCamp: moving on", () => {
  it("hands over a fresh mat on the next one", async () => {
    const user = userEvent.setup();
    screenFor();
    await typeAnswer(user, firstTask().target);

    await user.click(screen.getByRole("button", { name: "Next one" }));

    /*
     * The outcome, not the disappearance: `AnimatePresence` keeps the old win
     * panel mounted until an animation jsdom never runs, so asserting the
     * "Next one" button has gone would fail for the wrong reason.
     */
    expect(screen.getByText(/Task 2 · 1 done/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5" })).toBeEnabled();
    expect(screen.getByLabelText("Your answer")).toHaveTextContent("?");
  });

  it("celebrates a full meter and still lets the child keep practising", async () => {
    const user = userEvent.setup();
    screenFor(MASTERY_MAX);
    await typeAnswer(user, firstTask().target);

    // A full meter replaces "Next one" with the banner's own way on.
    expect(screen.queryByRole("button", { name: "Next one" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep practising" }));
    expect(screen.getByRole("heading", { name: "Name the number" })).toBeInTheDocument();
  });
});
