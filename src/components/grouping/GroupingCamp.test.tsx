import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GroupingCamp } from "./GroupingCamp";
import { generateGroupingTask } from "@/lib/math/groupingTasks";
import { expectedBlocks } from "@/lib/math/groupingTasks";
import { STARTING_DIFFICULTY } from "@/lib/domain/difficulty";
import { NO_PROGRESS } from "@/lib/domain/progress";
import { MASTERY_MAX, masteryGain } from "@/lib/domain/mastery";
import { CAMP_DEFINITIONS } from "@/lib/data/camps";
import { PLACE_LABEL } from "@/lib/domain/grouping";
import { localDateSchema, todayLocalDate } from "@/lib/domain/localDate";
import type { GroupingFocus } from "@/lib/domain/camp";
import type { ClimberProfile } from "@/lib/domain/onboarding";
import type { ClimbContext } from "@/lib/domain/milestones";
import { bodyOf, urlOf } from "@test/requests";

const fetchMock = vi.fn<typeof fetch>();

function solveCalls(): readonly string[] {
  return fetchMock.mock.calls
    .filter(([url]) => urlOf(url) === "/api/learner")
    .map(([, init]) => bodyOf(init));
}

const CLIMB: ClimbContext = {
  days: [],
  checkpointsPassed: 0,
  serverToday: localDateSchema.parse("2020-01-01"),
};

const PROFILE: ClimberProfile = { gradeBand: "2-3", interestTheme: "jungle" };

/** Camp 3 is the array camp; camp 4 is place value. */
const ARRAY_CAMP = CAMP_DEFINITIONS[2];
/*
 * No camp sets place-value grouping any more — camp 4 trades instead — but the
 * board and its reducer are still here and still worth covering, so this is a
 * camp definition made for the test rather than one off the mountain.
 */
const PLACE_CAMP = {
  ...CAMP_DEFINITIONS[3],
  mechanic: { kind: "array-grouping", focus: "place-value" },
} as const;

function screenFor(focus: GroupingFocus, startingMastery = 0) {
  const camp = focus === "array" ? ARRAY_CAMP : PLACE_CAMP;
  return render(
    <GroupingCamp
      camp={camp}
      focus={focus}
      profile={PROFILE}
      startingMastery={startingMastery}
      progressAtStart={NO_PROGRESS}
      climb={CLIMB}
    />,
  );
}

function firstTask(focus: GroupingFocus) {
  return generateGroupingTask(focus, PROFILE.gradeBand, STARTING_DIFFICULTY, 0);
}

/** Builds the array correctly by tapping the right strip the right number of times. */
async function buildArray(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const task = firstTask("array");
  if (task.kind !== "array") throw new Error("expected an array task");
  for (let row = 0; row < task.rows; row += 1) {
    await user.click(screen.getByRole("button", { name: `Add a row of ${String(task.cols)}` }));
  }
}

/** Builds the place-value target correctly, place by place. */
async function buildPlaceValue(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const task = firstTask("place-value");
  if (task.kind !== "place-value") throw new Error("expected a place-value task");
  const topUnit = task.unitChoices[0];
  for (const unit of task.unitChoices) {
    const wanted = expectedBlocks(task.target, unit, topUnit);
    const name = `Add one ${PLACE_LABEL[unit].toLowerCase().replace(/s$/, "")} block, worth ${String(unit)}`;
    for (let i = 0; i < wanted; i += 1) {
      await user.click(screen.getByRole("button", { name }));
    }
  }
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

describe("GroupingCamp: the array camp", () => {
  it("names the camp and its mechanic", () => {
    screenFor("array");
    expect(screen.getByRole("heading", { name: "Array building" })).toBeInTheDocument();
    expect(screen.getByText("Camp 3 · Glacier Field")).toBeInTheDocument();
  });

  it("states the multiplication without giving the product", () => {
    const { container } = screenFor("array");
    const task = firstTask("array");
    if (task.kind !== "array") throw new Error("expected an array task");
    const sum = container.querySelector("p.text-5xl");
    expect(sum?.textContent).toContain(`${String(task.rows)} × ${String(task.cols)}`);
    expect(sum?.textContent).not.toContain(String(task.rows * task.cols));
  });

  it("counts the tasks built", () => {
    screenFor("array");
    expect(screen.getByText("Task 1 · 0 built")).toBeInTheDocument();
  });

  it("pays the meter and offers the next task once built", async () => {
    const user = userEvent.setup();
    screenFor("array");
    await buildArray(user);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", String(masteryGain(0)));
    expect(screen.getByText("Built it first time. Nice work!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next one" })).toBeInTheDocument();
  });

  it("records the solve with the day and its cleanness", async () => {
    const user = userEvent.setup();
    screenFor("array");
    await buildArray(user);
    await waitFor(() => { expect(solveCalls()).toHaveLength(1); });
    expect(JSON.parse(solveCalls()[0] ?? "null")).toEqual({
      camp: 3,
      clean: true,
      localDate: todayLocalDate(),
    });
  });

  it("moves on to a fresh task", async () => {
    const user = userEvent.setup();
    screenFor("array");
    await buildArray(user);
    await user.click(screen.getByRole("button", { name: "Next one" }));
    expect(screen.getByText("Task 2 · 1 built")).toBeInTheDocument();
  });

  it("accepts the commuted array and says why it counts", async () => {
    const user = userEvent.setup();
    screenFor("array");
    const task = firstTask("array");
    if (task.kind !== "array") throw new Error("expected an array task");
    if (task.rows === task.cols) return; // a square has no commuted form
    for (let row = 0; row < task.cols; row += 1) {
      await user.click(screen.getByRole("button", { name: `Add a row of ${String(task.rows)}` }));
    }
    expect(
      screen.getByText(
        `${String(task.cols)} rows of ${String(task.rows)} makes the same array — good thinking.`,
      ),
    ).toBeInTheDocument();
  });
});

describe("GroupingCamp: a wrong build", () => {
  it("says at once when a strip cannot be a row of this array", async () => {
    const user = userEvent.setup();
    screenFor("array");
    const task = firstTask("array");
    if (task.kind !== "array") throw new Error("expected an array task");
    const wrong = task.stripChoices.find(
      (length) => length !== task.cols && length !== task.rows,
    );
    if (wrong === undefined) return;
    await user.click(screen.getByRole("button", { name: `Add a row of ${String(wrong)}` }));
    expect(
      screen.getByText(
        `That row is a different length. This array is built from rows of ${String(task.cols)}.`,
      ),
    ).toBeInTheDocument();
  });

  it("reacts warmly and costs no mastery", async () => {
    const user = userEvent.setup();
    screenFor("array", 30);
    const task = firstTask("array");
    if (task.kind !== "array") throw new Error("expected an array task");
    const wrong = task.stripChoices.find(
      (length) => length !== task.cols && length !== task.rows,
    );
    if (wrong === undefined) return;
    await user.click(screen.getByRole("button", { name: `Add a row of ${String(wrong)}` }));
    // A row that cannot fit is a shape problem, not a count that is off.
    expect(screen.getByText("Not yet!")).toBeInTheDocument();
    expect(screen.queryByText(/nearly/i)).not.toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "30");
    expect(solveCalls()).toHaveLength(0);
  });

  it("offers to start the task over", async () => {
    const user = userEvent.setup();
    screenFor("array");
    const task = firstTask("array");
    if (task.kind !== "array") throw new Error("expected an array task");
    const wrong = task.stripChoices.find(
      (length) => length !== task.cols && length !== task.rows,
    );
    if (wrong === undefined) return;
    await user.click(screen.getByRole("button", { name: `Add a row of ${String(wrong)}` }));
    await user.click(screen.getByRole("button", { name: "Start this one over" }));
    expect(screen.getByText(/Target:/)).toBeInTheDocument();
  });
});

describe("GroupingCamp: the place-value camp", () => {
  it("names the camp and its mechanic", () => {
    screenFor("place-value");
    expect(screen.getByRole("heading", { name: "Place-value grouping" })).toBeInTheDocument();
    expect(screen.getByText("Camp 4 · The Summit")).toBeInTheDocument();
  });

  it("asks for the target", () => {
    const { container } = screenFor("place-value");
    const task = firstTask("place-value");
    if (task.kind !== "place-value") throw new Error("expected a place-value task");
    expect(container.textContent).toContain(String(task.target));
  });

  it("pays the meter when the target is properly grouped", async () => {
    const user = userEvent.setup();
    screenFor("place-value");
    await buildPlaceValue(user);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", String(masteryGain(0)));
  });

  it("asks for a regroup when the value is right but the blocks are not", async () => {
    const user = userEvent.setup();
    screenFor("place-value");
    const task = firstTask("place-value");
    if (task.kind !== "place-value") throw new Error("expected a place-value task");
    // Build the whole target out of ones, which is the right number wrongly grouped.
    const ones = `Add one one block, worth 1`;
    for (let i = 0; i < task.target; i += 1) {
      await user.click(screen.getByRole("button", { name: ones }));
      if (screen.queryByText(/trade/i) !== null) break;
    }
    expect(screen.getByText(/trade/i)).toBeInTheDocument();
  }, 20_000);
});

describe("GroupingCamp: finishing", () => {
  it("shows the session summary when the child taps Finish", async () => {
    const user = userEvent.setup();
    screenFor("array");
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(screen.getByText("Session complete")).toBeInTheDocument();
  });

  it("stops asking for another task once the camp is full", () => {
    screenFor("array", MASTERY_MAX);
    expect(screen.queryByRole("button", { name: "Next one" })).not.toBeInTheDocument();
  });

  it("offers a way back to the map throughout", () => {
    screenFor("place-value");
    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map");
  });
});

describe("GroupingCamp: camp mastered", () => {
  it("celebrates a full meter, with the summit's own flag at camp 4", () => {
    const array = render(
      <GroupingCamp
        camp={ARRAY_CAMP}
        focus="array"
        profile={PROFILE}
        startingMastery={MASTERY_MAX}
        progressAtStart={NO_PROGRESS}
        climb={CLIMB}
      />,
    );
    expect(screen.getByRole("heading", { name: "Camp 3 mastered!" })).toBeInTheDocument();
    array.unmount();

    screenFor("place-value", MASTERY_MAX);
    expect(screen.getByRole("heading", { name: "Camp 4 mastered!" })).toBeInTheDocument();
    expect(screen.getByText("🏔️")).toBeInTheDocument();
  });

  it("lets the child keep practising a finished camp", async () => {
    const user = userEvent.setup();
    screenFor("array", MASTERY_MAX);
    await user.click(screen.getByRole("button", { name: "Keep practising" }));
    expect(screen.getByText("Task 2 · 0 built")).toBeInTheDocument();
  });

  it("offers the way back to the map from the celebration", () => {
    screenFor("array", MASTERY_MAX);
    expect(screen.getByRole("link", { name: "Back to the map" })).toHaveAttribute("href", "/map");
  });
});

describe("GroupingCamp: the hints the evaluator can reach", () => {
  /** K-1's first array is 3 × 4, so rows and columns differ. */
  const K1: ClimberProfile = { gradeBand: "k-1", interestTheme: "jungle" };

  function k1Array() {
    return render(
      <GroupingCamp
        camp={ARRAY_CAMP}
        focus="array"
        profile={K1}
        startingMastery={0}
        progressAtStart={NO_PROGRESS}
        climb={CLIMB}
      />,
    );
  }

  const k1Task = () => {
    const task = generateGroupingTask("array", "k-1", STARTING_DIFFICULTY, 0);
    if (task.kind !== "array") throw new Error("expected an array task");
    return task;
  };

  it("says rows must match when two valid-but-different strips are stacked", async () => {
    const user = userEvent.setup();
    k1Array();
    const { rows, cols } = k1Task();
    await user.click(screen.getByRole("button", { name: `Add a row of ${String(cols)}` }));
    await user.click(screen.getByRole("button", { name: `Add a row of ${String(rows)}` }));
    expect(
      screen.getByText("Every row in an array is the same length. Tap a row to take it off."),
    ).toBeInTheDocument();
  });

  it("accepts the commuted array and explains why it counts", async () => {
    const user = userEvent.setup();
    k1Array();
    const { rows, cols } = k1Task();
    for (let row = 0; row < cols; row += 1) {
      await user.click(screen.getByRole("button", { name: `Add a row of ${String(rows)}` }));
    }
    expect(
      screen.getByText(`${String(cols)} rows of ${String(rows)} makes the same array — good thinking.`),
    ).toBeInTheDocument();
  });

  it("lets a row be taken back off after a wrong stack", async () => {
    const user = userEvent.setup();
    k1Array();
    const { rows, cols } = k1Task();
    await user.click(screen.getByRole("button", { name: `Add a row of ${String(cols)}` }));
    await user.click(screen.getByRole("button", { name: `Add a row of ${String(rows)}` }));
    await user.click(screen.getByRole("button", { name: "Take off the last row" }));
    // One good row left, and the build is buildable again.
    for (let row = 1; row < rows; row += 1) {
      await user.click(screen.getByRole("button", { name: `Add a row of ${String(cols)}` }));
    }
    // Solved, and paid at the after-a-wobble rate rather than the clean one.
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", String(masteryGain(1)));
    expect(screen.getByText("Task 1 · 1 built")).toBeInTheDocument();
  });

  it("reacts warmly when a mat goes over the target, and lets a block come off", async () => {
    const user = userEvent.setup();
    const { container } = screenFor("place-value");
    const task = firstTask("place-value");
    if (task.kind !== "place-value") throw new Error("expected a place-value task");

    // Ones alone can pass the target without ever landing on it: at exactly
    // the target they are the right value wrongly grouped, and one more tips
    // the mat over.
    const ones = "Add one one block, worth 1";
    for (let i = 0; i < task.target + 2; i += 1) {
      await user.click(screen.getByRole("button", { name: ones }));
    }

    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe(`On the mat: ${String(task.target + 2)} of ${String(task.target)}`);
    // Past the target: the stamp says which way it is wrong.
    expect(screen.getByText("Too many!")).toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0");

    // ...and a block can come straight back off the mat. The block itself
    // animates out, so the running total is what confirms it left.
    const onMat = screen.getAllByRole("button", { name: /Take away one/ });
    await user.click(onMat[onMat.length - 1] as HTMLElement);
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(
      `On the mat: ${String(task.target + 1)} of ${String(task.target)}`,
    );
  }, 30_000);
});

describe("GroupingCamp: carrying on from the summary", () => {
  it("goes back to the task the child was on", async () => {
    const user = userEvent.setup();
    screenFor("array");
    await user.click(screen.getByRole("button", { name: "Finish" }));
    await user.click(screen.getByRole("button", { name: "Keep climbing here" }));
    expect(screen.getByRole("heading", { name: "Array building" })).toBeInTheDocument();
    expect(screen.getByText("Task 1 · 0 built")).toBeInTheDocument();
  });
});
