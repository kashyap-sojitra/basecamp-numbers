import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingScreen } from "./OnboardingScreen";
import { GRADE_BAND_OPTIONS, INTEREST_THEME_OPTIONS } from "@/lib/domain/onboarding";
import { jsonBodyOf } from "@test/requests";

const push = vi.fn<(href: string) => void>();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  push.mockReset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ saved: true }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

const grade = (label: string) => screen.getByRole("radio", { name: new RegExp(label) });

describe("OnboardingScreen: the two picks", () => {
  it("asks for a grade and a world", () => {
    render(<OnboardingScreen existing={null} />);
    expect(screen.getByRole("heading", { name: /Let's get you ready to climb/ })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Which one sounds like you?" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Pick your world" })).toBeInTheDocument();
  });

  it("offers every grade band and every world", () => {
    render(<OnboardingScreen existing={null} />);
    for (const option of GRADE_BAND_OPTIONS) {
      // The child-facing line, not the grade: that is what they read first.
      expect(screen.getByRole("radio", { name: new RegExp(option.stage) })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: new RegExp(option.grade) })).toBeInTheDocument();
    }
    for (const option of INTEREST_THEME_OPTIONS) {
      expect(screen.getByRole("radio", { name: new RegExp(option.label) })).toBeInTheDocument();
    }
  });

  it("starts with nothing chosen", () => {
    render(<OnboardingScreen existing={null} />);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAttribute("aria-checked", "false");
    }
  });

  it("cannot be started until both picks are made", async () => {
    const user = userEvent.setup();
    render(<OnboardingScreen existing={null} />);
    const start = screen.getByRole("button", { name: /Start climbing/ });
    expect(start).toBeDisabled();
    expect(screen.getByText("Choose one of each to begin.")).toBeInTheDocument();

    await user.click(grade("K–1"));
    expect(start).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: /Ocean/ }));
    expect(start).toBeEnabled();
    expect(screen.getByText("Camp 1 is waiting.")).toBeInTheDocument();
  });

  it("marks the chosen options and only those", async () => {
    const user = userEvent.setup();
    render(<OnboardingScreen existing={null} />);
    await user.click(grade("2–3"));
    expect(grade("2–3")).toHaveAttribute("aria-checked", "true");
    expect(grade("K–1")).toHaveAttribute("aria-checked", "false");
  });

  it("lets a pick be changed", async () => {
    const user = userEvent.setup();
    render(<OnboardingScreen existing={null} />);
    await user.click(grade("K–1"));
    await user.click(grade("4–5"));
    expect(grade("K–1")).toHaveAttribute("aria-checked", "false");
    expect(grade("4–5")).toHaveAttribute("aria-checked", "true");
  });

  it("starts from what a returning learner already chose", () => {
    render(<OnboardingScreen existing={{ gradeBand: "4-5", interestTheme: "jungle" }} />);
    expect(grade("4–5")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /Jungle/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: /Start climbing/ })).toBeEnabled();
  });
});

describe("OnboardingScreen: the keyboard", () => {
  it("moves through a radiogroup with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<OnboardingScreen existing={null} />);
    await user.click(grade("K–1"));
    await user.keyboard("{ArrowRight}");
    expect(grade("2–3")).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{ArrowLeft}");
    expect(grade("K–1")).toHaveAttribute("aria-checked", "true");
  });

  it("wraps around, as a radiogroup does", async () => {
    const user = userEvent.setup();
    render(<OnboardingScreen existing={null} />);
    await user.click(grade("K–1"));
    await user.keyboard("{ArrowLeft}");
    expect(grade("4–5")).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{ArrowRight}");
    expect(grade("K–1")).toHaveAttribute("aria-checked", "true");
  });

  it("treats up and down the same way", async () => {
    const user = userEvent.setup();
    render(<OnboardingScreen existing={null} />);
    await user.click(screen.getByRole("radio", { name: /Space/ }));
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: /Ocean/ })).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("radio", { name: /Space/ })).toHaveAttribute("aria-checked", "true");
  });

  it("ignores keys that are not navigation", async () => {
    const user = userEvent.setup();
    render(<OnboardingScreen existing={null} />);
    await user.click(grade("2–3"));
    await user.keyboard("x{Escape}");
    expect(grade("2–3")).toHaveAttribute("aria-checked", "true");
  });
});

describe("OnboardingScreen: saving", () => {
  async function pickBoth(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await user.click(grade("2–3"));
    await user.click(screen.getByRole("radio", { name: /Ocean/ }));
  }

  it("posts both picks and goes to the map", async () => {
    const user = userEvent.setup();
    render(<OnboardingScreen existing={null} />);
    await pickBoth(user);
    await user.click(screen.getByRole("button", { name: /Start climbing/ }));

    await waitFor(() => { expect(push).toHaveBeenCalledWith("/map"); });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/learner");
    expect(init?.method).toBe("POST");
    expect(jsonBodyOf(init)).toEqual({
      gradeBand: "2-3",
      interestTheme: "ocean",
    });
  });

  it("says it is working rather than looking broken", async () => {
    const user = userEvent.setup();
    let release: (value: Response) => void = () => undefined;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => { release = resolve; }));
    render(<OnboardingScreen existing={null} />);
    await pickBoth(user);
    await user.click(screen.getByRole("button", { name: /Start climbing/ }));
    expect(screen.getByRole("button", { name: /Packing your bag/ })).toBeDisabled();
    release(new Response(JSON.stringify({ saved: true }), { status: 200 }));
  });

  it("shows the server's own message when the save is refused", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "No database configured. Copy .env.example…" }), {
        status: 503,
      }),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<OnboardingScreen existing={null} />);
    await pickBoth(user);
    await user.click(screen.getByRole("button", { name: /Start climbing/ }));

    expect(await screen.findByText(/No database configured/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("lets the child try again after a failure", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<OnboardingScreen existing={null} />);
    await pickBoth(user);
    await user.click(screen.getByRole("button", { name: /Start climbing/ }));
    expect(await screen.findByText(/That did not save|offline/)).toBeInTheDocument();

    const start = await screen.findByRole("button", { name: /Start climbing/ });
    expect(start).toBeEnabled();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ saved: true }), { status: 200 }));
    await user.click(start);
    await waitFor(() => { expect(push).toHaveBeenCalledWith("/map"); });
  });

  it("announces the message politely", () => {
    render(<OnboardingScreen existing={null} />);
    const message = screen.getByText("Choose one of each to begin.");
    expect(message).toHaveAttribute("aria-live", "polite");
  });
});

describe("OnboardingScreen: the mountain preview", () => {
  it("stands in brand tints until a world is picked, then takes that world's colours", async () => {
    const user = userEvent.setup();
    const { container } = render(<OnboardingScreen existing={null} />);
    const preview = () => container.querySelector("[data-world]");
    expect(preview()).toHaveAttribute("data-world", "unpicked");
    expect(preview()).toHaveAttribute("aria-hidden");

    await user.click(screen.getByRole("radio", { name: /Ocean/ }));
    expect(preview()).toHaveAttribute("data-world", "ocean");
    await user.click(screen.getByRole("radio", { name: /Jungle/ }));
    expect(preview()).toHaveAttribute("data-world", "jungle");
  });

  it("paints every world card in that world's own sky", () => {
    render(<OnboardingScreen existing={null} />);
    for (const option of INTEREST_THEME_OPTIONS) {
      const card = screen.getByRole("radio", { name: new RegExp(option.label) });
      expect(card.style.backgroundColor).not.toBe("");
    }
  });
});
