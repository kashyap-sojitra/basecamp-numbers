import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckpointScreen } from "./CheckpointScreen";
import { CAMP_DEFINITIONS } from "@/lib/data/camps";
import { jumpChoices } from "@/lib/math/jumpChoices";
import { CHECKPOINT_QUESTIONS } from "@/lib/domain/decay";
import { generateJumpProblem } from "@/lib/math/numberLineProblems";
import { expectedBlocks, generateGroupingTask } from "@/lib/math/groupingTasks";
import { PLACE_LABEL } from "@/lib/domain/grouping";
import { STARTING_DIFFICULTY } from "@/lib/domain/difficulty";
import { generateTradeTask } from "@/lib/math/tradeTasks";
import { tradeHint, tradeQuestion } from "@/lib/domain/tradeCopy";
import type { ClimberProfile } from "@/lib/domain/onboarding";
import { urlOf } from "@test/requests";

const fetchMock = vi.fn<typeof fetch>();
const PROFILE: ClimberProfile = { gradeBand: "2-3", interestTheme: "space" };

/** Works out the answer to whatever sum the checkpoint is currently showing. */
function answerOnScreen(container: HTMLElement): number {
  const prompt = container.querySelector("p.text-4xl")?.textContent ?? "";
  const match = /(\d+)\s*([+\u2212])\s*(\d+)/.exec(prompt);
  if (match === null) throw new Error(`no sum on screen: ${prompt}`);
  const [, left, operator, right] = match;
  const start = Number(left);
  const change = Number(right);
  return operator === "+" ? start + change : start - change;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ restored: true }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

describe("CheckpointScreen: a number-line camp", () => {
  const camp = CAMP_DEFINITIONS[0];

  function firstProblem() {
    return generateJumpProblem("within-place", PROFILE.gradeBand, STARTING_DIFFICULTY, 0);
  }

  it("reviews the camp's own mechanic", () => {
    render(<CheckpointScreen camp={camp} profile={PROFILE} totalSolves={0} />);
    expect(screen.getByRole("group", { name: /Number line from/ })).toBeInTheDocument();
  });

  it("frames itself as a quick check, not another lesson", () => {
    render(<CheckpointScreen camp={camp} profile={PROFILE} totalSolves={0} />);
    expect(screen.getByText("Checkpoint")).toBeInTheDocument();
    expect(screen.getByLabelText(`0 of ${String(CHECKPOINT_QUESTIONS)} done`)).toBeInTheDocument();
  });

  it("shows no mastery meter, since a review restores rather than earns", () => {
    render(<CheckpointScreen camp={camp} profile={PROFILE} totalSolves={0} />);
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });

  it("confirms a right answer warmly and moves on", async () => {
    const user = userEvent.setup();
    render(<CheckpointScreen camp={camp} profile={PROFILE} totalSolves={0} />);
    const problem = firstProblem();
    await user.click(screen.getByRole("button", { name: `Land on ${String(problem.answer)}` }));
    expect(screen.getByText("Still got it.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next question" }));
    expect(screen.getByLabelText(`1 of ${String(CHECKPOINT_QUESTIONS)} done`)).toBeInTheDocument();
  });

  it("invites another go after a wrong answer, without scolding", async () => {
    const user = userEvent.setup();
    render(<CheckpointScreen camp={camp} profile={PROFILE} totalSolves={0} />);
    const problem = firstProblem();
    const wrong = problem.answer === problem.line.max ? problem.answer - 1 : problem.answer + 1;
    await user.click(screen.getByRole("button", { name: `Land on ${String(wrong)}` }));
    expect(screen.getByText("Not quite — have another go.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByLabelText(`0 of ${String(CHECKPOINT_QUESTIONS)} done`)).toBeInTheDocument();
  });

  it("brings the camp back once every question is answered", async () => {
    const user = userEvent.setup();
    const { container } = render(<CheckpointScreen camp={camp} profile={PROFILE} totalSolves={0} />);

    // The level moves after every answer, so the next problem cannot be
    // predicted — read it off the screen instead, as a child would.
    for (let question = 0; question < CHECKPOINT_QUESTIONS; question += 1) {
      await user.click(screen.getByRole("button", { name: `Land on ${String(answerOnScreen(container))}` }));
      const next = screen.queryByRole("button", { name: "Next question" });
      if (next !== null) await user.click(next);
    }

    expect(
      await screen.findByRole("heading", { name: `Camp ${String(camp.number)} is bright again!` }),
    ).toBeInTheDocument();
  });

  it("does not record solves, so a review cannot dim other camps", async () => {
    const user = userEvent.setup();
    render(<CheckpointScreen camp={camp} profile={PROFILE} totalSolves={0} />);
    const problem = firstProblem();
    await user.click(screen.getByRole("button", { name: `Land on ${String(problem.answer)}` }));
    expect(
      fetchMock.mock.calls.filter(([url]) => urlOf(url) === "/api/learner"),
    ).toHaveLength(0);
  });
});

describe("CheckpointScreen: a grouping camp", () => {
  const camp = CAMP_DEFINITIONS[2];

  it("reviews the grouping mechanic instead", () => {
    render(<CheckpointScreen camp={camp} profile={PROFILE} totalSolves={0} />);
    const task = generateGroupingTask("array", PROFILE.gradeBand, STARTING_DIFFICULTY, 0);
    if (task.kind !== "array") throw new Error("expected an array task");
    expect(
      screen.getByRole("button", { name: `Add a row of ${String(task.cols)}` }),
    ).toBeInTheDocument();
  });

  it("names the camp under review", () => {
    render(<CheckpointScreen camp={camp} profile={PROFILE} totalSolves={0} />);
    expect(
      screen.getByRole("heading", { name: `Camp 3 · ${camp.name}` }),
    ).toBeInTheDocument();
  });

  it("counts a correct build towards the review", async () => {
    const user = userEvent.setup();
    render(<CheckpointScreen camp={camp} profile={PROFILE} totalSolves={0} />);
    const task = generateGroupingTask("array", PROFILE.gradeBand, STARTING_DIFFICULTY, 0);
    if (task.kind !== "array") throw new Error("expected an array task");
    for (let row = 0; row < task.rows; row += 1) {
      await user.click(screen.getByRole("button", { name: `Add a row of ${String(task.cols)}` }));
    }
    expect(screen.getByText("Still got it.")).toBeInTheDocument();
  });
});

describe("CheckpointScreen: reviewing the summit", () => {
  const camp = CAMP_DEFINITIONS[3];

  function firstTask() {
    return generateTradeTask(PROFILE.gradeBand, STARTING_DIFFICULTY, 0);
  }

  async function typeAnswer(user: ReturnType<typeof userEvent.setup>, value: number) {
    for (const digit of String(value)) {
      await user.click(screen.getByRole("button", { name: digit }));
    }
    await user.click(screen.getByRole("button", { name: "Check my answer" }));
  }

  it("reviews the summit's own act: the mat as a question and a keypad to answer it", () => {
    render(<CheckpointScreen camp={camp} profile={PROFILE} totalSolves={0} />);
    expect(screen.getByText(tradeQuestion(PROFILE.gradeBand))).toBeInTheDocument();
    expect(screen.getByLabelText("Your answer")).toHaveTextContent("?");
    expect(screen.queryByText(String(firstTask().target))).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Trade/ })).not.toBeInTheDocument();
  });

  it("counts the right number towards the review", async () => {
    const user = userEvent.setup();
    render(<CheckpointScreen camp={camp} profile={PROFILE} totalSolves={0} />);
    await typeAnswer(user, firstTask().target);
    expect(screen.getByText("Still got it.")).toBeInTheDocument();
  });

  it("names the slip for a wrong number and lets the child go again", async () => {
    const user = userEvent.setup();
    render(<CheckpointScreen camp={camp} profile={PROFILE} totalSolves={0} />);
    const task = firstTask();
    await typeAnswer(user, task.target + 1);
    expect(screen.getByText(tradeHint(PROFILE.gradeBand, "off-by-one"))).toBeInTheDocument();
    expect(screen.getByText("Not quite — have another go.")).toBeInTheDocument();
  });
});

describe("CheckpointScreen: reviewing the place-value camp", () => {
  // Camp 4 trades now, so the place-value review is exercised through a
  // definition made here rather than one off the mountain.
  const camp = {
    ...CAMP_DEFINITIONS[3],
    mechanic: { kind: "array-grouping", focus: "place-value" },
  } as const;

  /** The blocks the target needs, place by place. */
  function blocksFor(): readonly { readonly name: string; readonly count: number }[] {
    const task = generateGroupingTask("place-value", PROFILE.gradeBand, STARTING_DIFFICULTY, 0);
    if (task.kind !== "place-value") throw new Error("expected a place-value task");
    const topUnit = task.unitChoices[0];
    return task.unitChoices.map((unit) => ({
      name: `Add one ${PLACE_LABEL[unit].toLowerCase().replace(/s$/, "")} block, worth ${String(unit)}`,
      count: expectedBlocks(task.target, unit, topUnit),
    }));
  }

  it("reviews the place-value mechanic", () => {
    render(<CheckpointScreen camp={camp} profile={PROFILE} totalSolves={0} />);
    expect(screen.getByText("Ones")).toBeInTheDocument();
  });

  it("counts a correct build towards the review", async () => {
    const user = userEvent.setup();
    render(<CheckpointScreen camp={camp} profile={PROFILE} totalSolves={0} />);
    for (const { name, count } of blocksFor()) {
      for (let i = 0; i < count; i += 1) {
        await user.click(screen.getByRole("button", { name }));
      }
    }
    expect(screen.getByText("Still got it.")).toBeInTheDocument();
  });

  it("asks for a regroup when the value is right but the blocks are not", async () => {
    const user = userEvent.setup();
    render(<CheckpointScreen camp={camp} profile={PROFILE} totalSolves={0} />);
    const task = generateGroupingTask("place-value", PROFILE.gradeBand, STARTING_DIFFICULTY, 0);
    if (task.kind !== "place-value") throw new Error("expected a place-value task");

    const [topUnit, nextUnit] = task.unitChoices;
    if (nextUnit === undefined) throw new Error("expected at least two places");
    const label = (unit: number) =>
      `Add one ${PLACE_LABEL[unit as 1 | 10 | 100 | 1000].toLowerCase().replace(/s$/, "")} block, worth ${String(unit)}`;

    // Build the right number the wrong way: one fewer block in the top place,
    // made up with ten of the place below. Same value, not yet regrouped.
    const topBlocks = expectedBlocks(task.target, topUnit, topUnit);
    for (let i = 0; i < topBlocks - 1; i += 1) {
      await user.click(screen.getByRole("button", { name: label(topUnit) }));
    }
    const belowBlocks = expectedBlocks(task.target, nextUnit, topUnit) + 10;
    for (let i = 0; i < belowBlocks; i += 1) {
      await user.click(screen.getByRole("button", { name: label(nextUnit) }));
    }

    expect(screen.getByText("Not quite — have another go.")).toBeInTheDocument();
  }, 20_000);

  it("lets a wrong build be cleared and tried again", async () => {
    const user = userEvent.setup();
    const { container } = render(<CheckpointScreen camp={camp} profile={PROFILE} totalSolves={0} />);
    const task = generateGroupingTask("place-value", PROFILE.gradeBand, STARTING_DIFFICULTY, 0);
    if (task.kind !== "place-value") throw new Error("expected a place-value task");

    // Overshoot the target with the smallest blocks, which cannot solve it.
    const ones = "Add one one block, worth 1";
    for (let i = 0; i < task.target + 2; i += 1) {
      await user.click(screen.getByRole("button", { name: ones }));
      if (screen.queryByRole("button", { name: "Try again" }) !== null) break;
    }
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByLabelText(`0 of ${String(CHECKPOINT_QUESTIONS)} done`)).toBeInTheDocument();
    // The mat is empty again — the running total is split across elements, so
    // read the live region rather than a single text node.
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toContain("On the mat: 0 of");
  }, 30_000);

  it("offers read-aloud in a K-1 checkpoint", () => {
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        constructor(public text: string) {}
      },
    );
    vi.stubGlobal("speechSynthesis", {
      speaking: false,
      cancel: () => undefined,
      speak: () => undefined,
    });
    render(
      <CheckpointScreen
        camp={CAMP_DEFINITIONS[0]}
        profile={{ gradeBand: "k-1", interestTheme: "space" }}
        totalSolves={0}
      />,
    );
    expect(screen.getByRole("button", { name: "Read the problem aloud" })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

describe("CheckpointScreen: reviewing the pick-the-landing camp", () => {
  const camp = CAMP_DEFINITIONS[1];

  function board() {
    const problem = generateJumpProblem("cross-place", PROFILE.gradeBand, STARTING_DIFFICULTY, 0);
    return { problem, choices: jumpChoices(problem, PROFILE.gradeBand) };
  }

  it("offers four landings and counts a right one towards the review", async () => {
    const user = userEvent.setup();
    const { problem } = board();
    render(<CheckpointScreen camp={camp} profile={PROFILE} totalSolves={0} />);

    expect(screen.getAllByRole("button", { name: /^Lands on/ })).toHaveLength(4);
    await user.click(screen.getByRole("button", { name: `Lands on ${String(problem.answer)}` }));

    expect(screen.getByText("Still got it.")).toBeInTheDocument();
  });

  it("lets a wrong landing be tried again", async () => {
    const user = userEvent.setup();
    const { problem, choices } = board();
    render(<CheckpointScreen camp={camp} profile={PROFILE} totalSolves={0} />);

    const wrong = choices.find((choice) => choice !== problem.answer);
    if (wrong === undefined) return;
    await user.click(screen.getByRole("button", { name: `Lands on ${String(wrong)}` }));
    expect(screen.getByText("Not quite — have another go.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /another go|Try again/i }));
    await user.click(screen.getByRole("button", { name: `Lands on ${String(problem.answer)}` }));
    expect(screen.getByText("Still got it.")).toBeInTheDocument();
  });
});
