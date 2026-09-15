import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumberLineJumpCamp } from "./NumberLineJumpCamp";
import { generateJumpProblem } from "@/lib/math/numberLineProblems";
import { NO_PROGRESS } from "@/lib/domain/progress";
import { STARTING_DIFFICULTY } from "@/lib/domain/difficulty";
import { MASTERY_MAX, masteryGain } from "@/lib/domain/mastery";
import { CAMP_DEFINITIONS } from "@/lib/data/camps";
import { localDateSchema, todayLocalDate } from "@/lib/domain/localDate";
import type { ClimberProfile } from "@/lib/domain/onboarding";
import type { ClimbContext } from "@/lib/domain/milestones";
import { bodyOf, urlOf } from "@test/requests";
import { diagnoseJump } from "@/lib/domain/jumpDiagnosis";
import { jumpMiss, reactionWord } from "@/lib/domain/reaction";

const fetchMock = vi.fn<typeof fetch>();

/** The solve-recording calls only — the camp also talks to the coach. */
function solveCalls(): readonly string[] {
  return fetchMock.mock.calls
    .filter(([url]) => urlOf(url) === "/api/learner")
    .map(([, init]) => bodyOf(init));
}

/** jsdom has no Web Speech API, and K-1 shows a button only where there is one. */
function installSpeech(): void {
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      text: string;
      rate = 1;
      pitch = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    },
  );
  vi.stubGlobal("speechSynthesis", { speaking: false, cancel: () => undefined, speak: () => undefined });
}

const CLIMB: ClimbContext = {
  days: [],
  checkpointsPassed: 0,
  serverToday: localDateSchema.parse("2020-01-01"),
};

const CAMP = CAMP_DEFINITIONS[0];

function screenFor(profile: ClimberProfile, startingMastery = 0) {
  return render(
    <NumberLineJumpCamp
      camp={CAMP}
      skill="within-place"
      profile={profile}
      startingMastery={startingMastery}
      progressAtStart={NO_PROGRESS}
      climb={CLIMB}
    />,
  );
}

/** The problem the camp opens on, computed the same way the camp does. */
function firstProblem(band: ClimberProfile["gradeBand"]) {
  return generateJumpProblem("within-place", band, STARTING_DIFFICULTY, 0);
}

const K1: ClimberProfile = { gradeBand: "k-1", interestTheme: "space" };
const G23: ClimberProfile = { gradeBand: "2-3", interestTheme: "ocean" };

beforeEach(() => {
  fetchMock.mockReset();
  // The coach answers with a template-shaped framing; the solve endpoint
  // answers saved. Anything else would leave the screen in its loader.
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

describe("NumberLineJumpCamp: the header", () => {
  it("names the camp and what it practises", () => {
    screenFor(G23);
    expect(screen.getByRole("heading", { name: "Number-line jump" })).toBeInTheDocument();
    expect(screen.getByText("Camp 1 · Trailhead")).toBeInTheDocument();
    // 2-3 practises regrouping, not staying inside a ten — see jumpWords.
    expect(screen.getByText("Jumps with no carrying, up to 100")).toBeInTheDocument();
  });

  it("shows the saved meter it opened with", () => {
    screenFor(G23, 42);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "42");
  });

  it("offers a way back to the map and a way to finish", () => {
    screenFor(G23);
    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map");
    expect(screen.getByRole("button", { name: "Finish" })).toBeInTheDocument();
  });
});

describe("NumberLineJumpCamp: the problem", () => {
  it("states the sum without giving the answer", () => {
    const { container } = screenFor(G23);
    const problem = firstProblem("2-3");
    const sum = container.querySelector("p.text-5xl");
    expect(sum?.textContent).toContain(String(problem.start));
    expect(sum?.textContent).toContain(String(problem.change));
    expect(sum?.textContent).toContain(problem.operation === "add" ? "+" : "−");
    expect(sum?.textContent).toContain("?");
    expect(sum?.textContent).not.toContain(String(problem.answer));
  });

  it("says where to start and how far to jump", () => {
    screenFor(G23);
    const problem = firstProblem("2-3");
    const instruction = screen.getByText(/Start at/);
    expect(instruction.textContent).toContain(String(problem.start));
    expect(instruction.textContent).toContain(String(problem.change));
    expect(instruction.textContent).toContain(problem.operation === "add" ? "forward" : "back");
  });

  it("counts the jumps and the landings", () => {
    screenFor(G23);
    expect(screen.getByText("Jump 1 · 0 landed")).toBeInTheDocument();
  });

  it("offers read-aloud for K-1, where reading is the barrier", () => {
    installSpeech();
    screenFor(K1);
    expect(screen.getByRole("button", { name: "Read the problem aloud" })).toBeInTheDocument();
  });

  it("does not offer read-aloud past K-1", () => {
    installSpeech();
    screenFor(G23);
    expect(screen.queryByRole("button", { name: "Read the problem aloud" })).not.toBeInTheDocument();
  });
});

describe("NumberLineJumpCamp: a right answer", () => {
  it("confirms the sum, pays the meter and offers the next jump", async () => {
    const user = userEvent.setup();
    screenFor(G23);
    const problem = firstProblem("2-3");
    await user.click(screen.getByRole("button", { name: `Land on ${String(problem.answer)}` }));

    expect(screen.getByText(new RegExp(`= ${String(problem.answer)}`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`\\+${String(masteryGain(0))} mastery`))).toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", String(masteryGain(0)));
    expect(screen.getByRole("button", { name: "Next jump" })).toBeInTheDocument();
  });

  it("celebrates over the board, not over the button the child needs next", async () => {
    const user = userEvent.setup();
    screenFor(G23);
    const problem = firstProblem("2-3");
    await user.click(screen.getByRole("button", { name: `Land on ${String(problem.answer)}` }));
    expect(screen.getByText("YAY!")).toBeInTheDocument();
    // The burst lives in the board's own container, above the feedback panel.
    const burst = screen.getByText("YAY!").closest('[aria-hidden="true"]');
    expect(burst).not.toBeNull();
    expect(burst?.contains(screen.getByRole("button", { name: "Next jump" }))).toBe(false);
  });

  it("records the solve, with today's date and its cleanness", async () => {
    const user = userEvent.setup();
    screenFor(G23);
    const problem = firstProblem("2-3");
    await user.click(screen.getByRole("button", { name: `Land on ${String(problem.answer)}` }));
    await waitFor(() => { expect(solveCalls()).toHaveLength(1); });
    expect(JSON.parse(solveCalls()[0] ?? "null")).toEqual({
      camp: 1,
      clean: true,
      localDate: todayLocalDate(),
    });
  });

  it("moves on to a fresh problem", async () => {
    const user = userEvent.setup();
    screenFor(G23);
    const problem = firstProblem("2-3");
    await user.click(screen.getByRole("button", { name: `Land on ${String(problem.answer)}` }));
    await user.click(screen.getByRole("button", { name: "Next jump" }));
    expect(screen.getByText("Jump 2 · 1 landed")).toBeInTheDocument();
  });
});

describe("NumberLineJumpCamp: a wrong answer", () => {
  /** A landing that is definitely not the answer, but is on the line. */
  function wrongTick(answer: number, min: number, max: number): number {
    return answer === max ? max - 1 : answer + 1 > max ? min : answer + 1;
  }

  it("says where the child landed, and names the slip the rule diagnosed", async () => {
    const user = userEvent.setup();
    screenFor(G23);
    const problem = firstProblem("2-3");
    const wrong = wrongTick(problem.answer, problem.line.min, problem.line.max);
    await user.click(screen.getByRole("button", { name: `Land on ${String(wrong)}` }));
    // Asserted against the rule rather than a copied string, so the screen and
    // `diagnoseJump` cannot drift apart.
    const { nudge } = diagnoseJump(problem, wrong);
    expect(
      screen.getByText(new RegExp(`You landed on ${String(wrong)}`)),
    ).toHaveTextContent(nudge);
  });

  it("tells the coach the same diagnosis it showed the child", async () => {
    const user = userEvent.setup();
    screenFor(G23);
    const problem = firstProblem("2-3");
    const wrong = wrongTick(problem.answer, problem.line.min, problem.line.max);
    await user.click(screen.getByRole("button", { name: `Land on ${String(wrong)}` }));
    await waitFor(() => {
      const asked = fetchMock.mock.calls
        .filter(([url]) => urlOf(url) === "/api/coach")
        .map(([, init]) => bodyOf(init))
        .filter((body) => body.includes("encouragement"));
      expect(asked.length).toBeGreaterThan(0);
      // The model is handed the specific slip, not just "incorrect".
      expect(asked.some((body) => body.includes(diagnoseJump(problem, wrong).nudge))).toBe(true);
    });
  });

  it("reacts warmly, never with a cross", async () => {
    const user = userEvent.setup();
    screenFor(G23);
    const problem = firstProblem("2-3");
    const wrong = wrongTick(problem.answer, problem.line.min, problem.line.max);
    await user.click(screen.getByRole("button", { name: `Land on ${String(wrong)}` }));
    // The stamp says how far off that tick was, in the rule's own words.
    expect(screen.getByText(reactionWord(jumpMiss(problem, wrong)))).toBeInTheDocument();
    expect(screen.queryByText("❌")).not.toBeInTheDocument();
  });

  it("costs no mastery and records nothing", async () => {
    const user = userEvent.setup();
    screenFor(G23, 20);
    const problem = firstProblem("2-3");
    const wrong = wrongTick(problem.answer, problem.line.min, problem.line.max);
    await user.click(screen.getByRole("button", { name: `Land on ${String(wrong)}` }));
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "20");
    expect(solveCalls()).toHaveLength(0);
  });

  it("offers another go, and takes it", async () => {
    const user = userEvent.setup();
    screenFor(G23);
    const problem = firstProblem("2-3");
    const wrong = wrongTick(problem.answer, problem.line.min, problem.line.max);
    await user.click(screen.getByRole("button", { name: `Land on ${String(wrong)}` }));
    await user.click(screen.getByRole("button", { name: "Try again" }));
    // The line is live again, and the eventual solve pays the after-retry rate
    // rather than the clean one.
    await user.click(screen.getByRole("button", { name: `Land on ${String(problem.answer)}` }));
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", String(masteryGain(1)));
    expect(masteryGain(1)).toBeLessThan(masteryGain(0));
  });

  it("announces the feedback politely rather than silently", async () => {
    const user = userEvent.setup();
    const { container } = screenFor(G23);
    const problem = firstProblem("2-3");
    const wrong = wrongTick(problem.answer, problem.line.min, problem.line.max);
    await user.click(screen.getByRole("button", { name: `Land on ${String(wrong)}` }));
    // The screen has two polite regions: the coach's loader and the feedback.
    const regions = [...container.querySelectorAll('[aria-live="polite"]')];
    expect(regions.some((region) => region.textContent.includes("You landed on"))).toBe(true);
  });
});

describe("NumberLineJumpCamp: finishing", () => {
  it("shows the session summary when the child taps Finish", async () => {
    const user = userEvent.setup();
    screenFor(G23);
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(screen.getByText("Session complete")).toBeInTheDocument();
  });

  it("can carry on climbing from the summary", async () => {
    const user = userEvent.setup();
    screenFor(G23);
    await user.click(screen.getByRole("button", { name: "Finish" }));
    await user.click(screen.getByRole("button", { name: "Keep climbing here" }));
    expect(screen.getByRole("heading", { name: "Number-line jump" })).toBeInTheDocument();
  });

  it("celebrates a full meter and stops asking for another jump", () => {
    screenFor(G23, MASTERY_MAX);
    expect(screen.queryByRole("button", { name: "Next jump" })).not.toBeInTheDocument();
  });
});

describe("NumberLineJumpCamp: camp mastered", () => {
  it("celebrates a full meter", () => {
    screenFor(G23, MASTERY_MAX);
    expect(screen.getByRole("heading", { name: "Camp 1 mastered!" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the map" })).toHaveAttribute("href", "/map");
  });

  it("lets the child keep practising a finished camp", async () => {
    const user = userEvent.setup();
    screenFor(G23, MASTERY_MAX);
    expect(screen.getByText("Jump 1 · 0 landed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep practising" }));
    expect(screen.getByText("Jump 2 · 0 landed")).toBeInTheDocument();
    // The meter is already full, so practising cannot take it anywhere else.
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", String(MASTERY_MAX));
  });

  it("still records those solves, since they are what dim the other camps", async () => {
    const user = userEvent.setup();
    screenFor(G23, MASTERY_MAX);
    const problem = firstProblem("2-3");
    await user.click(screen.getByRole("button", { name: `Land on ${String(problem.answer)}` }));
    await waitFor(() => { expect(solveCalls()).toHaveLength(1); });
    // The solve is reported; what it is worth is the server's decision.
    expect(JSON.parse(solveCalls()[0] ?? "null")).toMatchObject({ camp: 1, clean: true });
  });
});
