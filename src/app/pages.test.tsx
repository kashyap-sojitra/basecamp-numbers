import { beforeEach, describe, expect, it, vi } from "vitest";
import { MASTERY_MAX } from "@/lib/domain/mastery";
import { NO_PROGRESS, type LearnerProgress } from "@/lib/domain/progress";
import type { LearnerState } from "@/lib/db/learnerRepository";
import type { CampNumber } from "@/lib/domain/camp";

/* -------------------------------------------------------------------------- */
/* The pages are server components: they read a cookie, load state, and either
   redirect or hand a screen its props. These tests exercise that routing
   logic, with the screens themselves stubbed — they have their own tests.    */

class RedirectError extends Error {
  constructor(readonly to: string) {
    super(`redirect:${to}`);
  }
}

const redirect = vi.fn((to: string): never => {
  throw new RedirectError(to);
});
vi.mock("next/navigation", () => ({ redirect }));

const readLearnerId = vi.fn<() => Promise<string | null>>();
vi.mock("@/lib/learner/session", () => ({ readLearnerId }));

const loadLearnerState = vi.fn<() => Promise<LearnerState | null>>();
vi.mock("@/lib/db/learnerRepository", () => ({ loadLearnerState }));

/** Each screen is stubbed to echo the props it was handed. */
vi.mock("@/components/onboarding/OnboardingScreen", () => ({
  OnboardingScreen: (props: unknown) => ({ screen: "onboarding", props }),
}));
vi.mock("@/components/map/AdventureMap", () => ({
  AdventureMap: (props: unknown) => ({ screen: "map", props }),
}));
vi.mock("@/components/log/ClimbLog", () => ({
  ClimbLog: (props: unknown) => ({ screen: "log", props }),
}));
vi.mock("@/components/numberline/NumberLineJumpCamp", () => ({
  NumberLineJumpCamp: (props: unknown) => ({ screen: "jump", props }),
}));
vi.mock("@/components/grouping/GroupingCamp", () => ({
  GroupingCamp: (props: unknown) => ({ screen: "grouping", props }),
}));
vi.mock("@/components/trade/TradeUpCamp", () => ({
  TradeUpCamp: (props: unknown) => ({ screen: "trade", props }),
}));
vi.mock("@/components/quiz/PickTheJumpCamp", () => ({
  PickTheJumpCamp: (props: unknown) => ({ screen: "pick", props }),
}));
vi.mock("@/components/checkpoint/CheckpointScreen", () => ({
  CheckpointScreen: (props: unknown) => ({ screen: "checkpoint", props }),
}));

const Home = (await import("./page")).default;
const MapPage = (await import("./map/page")).default;
const LogPage = (await import("./log/page")).default;
const CampPage = (await import("./camp/[camp]/page")).default;
const CheckpointPage = (await import("./checkpoint/[camp]/page")).default;

const LEARNER = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function stateWith(progress: LearnerProgress = NO_PROGRESS): LearnerState {
  const empty = { progress: NO_PROGRESS, checkpointsPassed: 0 };
  return {
    profile: { gradeBand: "2-3", interestTheme: "ocean" },
    progress,
    checkpointsPassed: 0,
    climbs: { "k-1": empty, "2-3": { progress, checkpointsPassed: 0 }, "4-5": empty },
    days: [],
  };
}

function progressOf(
  totalSolves: number,
  camps: Partial<Record<CampNumber, { earned: number; touchedAtSolve: number }>>,
): LearnerProgress {
  return {
    totalSolves,
    camps: {
      1: camps[1] ?? { earned: 0, touchedAtSolve: 0 },
      2: camps[2] ?? { earned: 0, touchedAtSolve: 0 },
      3: camps[3] ?? { earned: 0, touchedAtSolve: 0 },
      4: camps[4] ?? { earned: 0, touchedAtSolve: 0 },
    },
  };
}

/** The props a page handed its screen, or the redirect it threw instead. */
async function rendered(page: Promise<unknown>): Promise<Record<string, unknown>> {
  const element = (await page) as { props: { screen: string; props: Record<string, unknown> } };
  const invoked = (element.props as unknown as { screen?: string }).screen;
  if (invoked !== undefined) return element.props;
  // React elements from a stubbed component: call it to read the props back.
  const { type } = element as unknown as {
    type: (props: unknown) => { screen: string; props: Record<string, unknown> };
  };
  const result = type((element as { props: unknown }).props);
  return { screen: result.screen, ...result.props };
}

beforeEach(() => {
  redirect.mockClear();
  readLearnerId.mockReset().mockResolvedValue(null);
  loadLearnerState.mockReset().mockResolvedValue(null);
});

/* -------------------------------------------------------------------------- */

describe("/ (onboarding)", () => {
  it("shows onboarding to a first-time visitor", async () => {
    const view = await rendered(Home({ searchParams: Promise.resolve({}), params: Promise.resolve({}) }));
    expect(view.screen).toBe("onboarding");
    expect(view.existing).toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("sends a returning learner straight to their mountain", async () => {
    readLearnerId.mockResolvedValue(LEARNER);
    loadLearnerState.mockResolvedValue(stateWith());
    await expect(
      Home({ searchParams: Promise.resolve({}), params: Promise.resolve({}) }),
    ).rejects.toThrow("redirect:/map");
  });

  it("reopens onboarding on ?change, with their picks already filled in", async () => {
    readLearnerId.mockResolvedValue(LEARNER);
    loadLearnerState.mockResolvedValue(stateWith());
    const view = await rendered(
      Home({ searchParams: Promise.resolve({ change: "1" }), params: Promise.resolve({}) }),
    );
    expect(view.screen).toBe("onboarding");
    expect(view.existing).toEqual({ gradeBand: "2-3", interestTheme: "ocean" });
  });

  it("shows onboarding when the database cannot be reached", async () => {
    readLearnerId.mockResolvedValue(LEARNER);
    loadLearnerState.mockResolvedValue(null);
    const view = await rendered(
      Home({ searchParams: Promise.resolve({}), params: Promise.resolve({}) }),
    );
    expect(view.screen).toBe("onboarding");
  });
});

describe("/map", () => {
  it("sends a visitor with nothing saved back to onboarding", async () => {
    await expect(MapPage()).rejects.toThrow(
      "redirect:/",
    );
  });

  it("hands the map the learner's profile, progress and climb log", async () => {
    readLearnerId.mockResolvedValue(LEARNER);
    loadLearnerState.mockResolvedValue(stateWith());
    const view = await rendered(
      MapPage(),
    );
    expect(view.screen).toBe("map");
    expect(view.profile).toEqual({ gradeBand: "2-3", interestTheme: "ocean" });
    expect(view.progress).toEqual(NO_PROGRESS);
    expect(view.days).toEqual([]);
    expect(view.serverToday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("/log", () => {
  it("sends a visitor with nothing saved back to onboarding", async () => {
    await expect(LogPage()).rejects.toThrow(
      "redirect:/",
    );
  });

  it("hands the log everything it derives from, including the checkpoint count", async () => {
    readLearnerId.mockResolvedValue(LEARNER);
    loadLearnerState.mockResolvedValue({ ...stateWith(), checkpointsPassed: 2 });
    const view = await rendered(
      LogPage(),
    );
    expect(view.screen).toBe("log");
    expect(view.checkpointsPassed).toBe(2);
    expect(view.serverToday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("/camp/[camp]", () => {
  beforeEach(() => {
    readLearnerId.mockResolvedValue(LEARNER);
    loadLearnerState.mockResolvedValue(stateWith());
  });

  it("sends a visitor with nothing saved back to onboarding", async () => {
    loadLearnerState.mockResolvedValue(null);
    await expect(
      CampPage({ params: Promise.resolve({ camp: "1" }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("redirect:/");
  });

  it("opens the number line for camp 1 only — camp 2 chooses a landing instead", async () => {
    const one = await rendered(
      CampPage({ params: Promise.resolve({ camp: "1" }), searchParams: Promise.resolve({}) }),
    );
    expect(one.screen).toBe("jump");
    const two = await rendered(
      CampPage({ params: Promise.resolve({ camp: "2" }), searchParams: Promise.resolve({}) }),
    );
    expect(two.screen).toBe("pick");
  });

  it("opens a different mechanic for every camp, so no two play the same", async () => {
    const opened: string[] = [];
    for (const camp of ["1", "2", "3", "4"]) {
      const view = await rendered(
        CampPage({ params: Promise.resolve({ camp }), searchParams: Promise.resolve({}) }),
      );
      opened.push(String(view.screen));
    }
    expect(opened).toEqual(["jump", "pick", "grouping", "trade"]);
  });

  it("hands the camp its saved meter and the whole record", async () => {
    loadLearnerState.mockResolvedValue(
      stateWith(progressOf(8, { 1: { earned: 42, touchedAtSolve: 8 } })),
    );
    const view = await rendered(
      CampPage({ params: Promise.resolve({ camp: "1" }), searchParams: Promise.resolve({}) }),
    );
    expect(view.startingMastery).toBe(42);
    expect(view.climb).toMatchObject({ days: [], checkpointsPassed: 0 });
  });

  it("sends a made-up camp number back to the map", async () => {
    for (const camp of ["5", "0", "banana", ""]) {
      await expect(
        CampPage({ params: Promise.resolve({ camp }), searchParams: Promise.resolve({}) }),
      ).rejects.toThrow("redirect:/map");
    }
  });
});

describe("/checkpoint/[camp]", () => {
  /** A record where camp 1 is mastered but long untouched. */
  const dimmed = progressOf(500, {
    1: { earned: MASTERY_MAX, touchedAtSolve: 0 },
    2: { earned: MASTERY_MAX, touchedAtSolve: 500 },
  });

  beforeEach(() => {
    readLearnerId.mockResolvedValue(LEARNER);
    loadLearnerState.mockResolvedValue(stateWith(dimmed));
  });

  it("sends a visitor with nothing saved back to onboarding", async () => {
    loadLearnerState.mockResolvedValue(null);
    await expect(
      CheckpointPage({ params: Promise.resolve({ camp: "1" }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("redirect:/");
  });

  it("opens the review for a camp that has gone dim", async () => {
    const view = await rendered(
      CheckpointPage({ params: Promise.resolve({ camp: "1" }), searchParams: Promise.resolve({}) }),
    );
    expect(view.screen).toBe("checkpoint");
    expect(view.profile).toEqual({ gradeBand: "2-3", interestTheme: "ocean" });
  });

  it("refuses a checkpoint the child does not owe", async () => {
    // Camp 2 is bright, so there is nothing to review there.
    await expect(
      CheckpointPage({ params: Promise.resolve({ camp: "2" }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("redirect:/map");
  });

  it("refuses a checkpoint for a camp that was never mastered", async () => {
    loadLearnerState.mockResolvedValue(stateWith(NO_PROGRESS));
    await expect(
      CheckpointPage({ params: Promise.resolve({ camp: "1" }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("redirect:/map");
  });

  it("sends a made-up camp number back to the map", async () => {
    await expect(
      CheckpointPage({ params: Promise.resolve({ camp: "9" }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("redirect:/map");
  });
});
