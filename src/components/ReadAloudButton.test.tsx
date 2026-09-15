import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadAloudButton } from "./ReadAloudButton";

/** A stand-in for the Web Speech API, which jsdom does not implement. */
interface FakeUtterance {
  text: string;
  rate: number;
  pitch: number;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

let spoken: FakeUtterance[] = [];
let speaking = false;
const cancel = vi.fn(() => { speaking = false; });

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
  vi.stubGlobal("speechSynthesis", {
    get speaking() {
      return speaking;
    },
    cancel,
    speak: (utterance: FakeUtterance) => {
      spoken.push(utterance);
      speaking = true;
    },
  });
}

beforeEach(() => {
  spoken = [];
  speaking = false;
  cancel.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ReadAloudButton", () => {
  it("renders nothing in a browser that cannot speak", () => {
    // No speechSynthesis stubbed: offering a button that does nothing is
    // worse than offering none.
    const { container } = render(<ReadAloudButton text="8 plus 7 equals what?" />);
    expect(container.firstChild).toBeNull();
  });

  it("offers a labelled button where speech is available", () => {
    installSpeech();
    render(<ReadAloudButton text="8 plus 7 equals what?" />);
    expect(screen.getByRole("button", { name: "Read the problem aloud" })).toBeInTheDocument();
  });

  it("meets the 44px tap target", () => {
    installSpeech();
    render(<ReadAloudButton text="anything" />);
    expect(screen.getByRole("button")).toHaveClass("size-11");
  });

  it("keeps its icon decorative, since the button carries the label", () => {
    installSpeech();
    const { container } = render(<ReadAloudButton text="anything" />);
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe("🔊");
  });

  it("speaks the words it was given", async () => {
    installSpeech();
    const user = userEvent.setup();
    render(<ReadAloudButton text="8 plus 7 equals what?" />);
    await user.click(screen.getByRole("button"));
    expect(spoken).toHaveLength(1);
    expect(spoken[0]?.text).toBe("8 plus 7 equals what?");
  });

  it("speaks slowly by default, for the youngest readers", async () => {
    installSpeech();
    const user = userEvent.setup();
    render(<ReadAloudButton text="anything" />);
    await user.click(screen.getByRole("button"));
    expect(spoken[0]?.rate).toBeLessThan(1);
  });

  it("honours a requested rate", async () => {
    installSpeech();
    const user = userEvent.setup();
    render(<ReadAloudButton text="anything" rate={0.5} />);
    await user.click(screen.getByRole("button"));
    expect(spoken[0]?.rate).toBe(0.5);
  });

  it("offers to stop once it is reading", async () => {
    installSpeech();
    const user = userEvent.setup();
    render(<ReadAloudButton text="anything" />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("button", { name: "Stop reading" })).toBeInTheDocument();
  });

  it("stops when tapped again, which is what a child expects", async () => {
    installSpeech();
    const user = userEvent.setup();
    render(<ReadAloudButton text="anything" />);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("button"));
    expect(cancel).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Read the problem aloud" })).toBeInTheDocument();
  });

  it("goes back to offering a read once the voice finishes", async () => {
    installSpeech();
    const user = userEvent.setup();
    render(<ReadAloudButton text="anything" />);
    await user.click(screen.getByRole("button"));
    const utterance = spoken[0];
    if (utterance?.onend == null) throw new Error("no end handler");
    speaking = false;
    utterance.onend();
    expect(await screen.findByRole("button", { name: "Read the problem aloud" })).toBeInTheDocument();
  });

  it("recovers if the voice errors rather than staying stuck", async () => {
    installSpeech();
    const user = userEvent.setup();
    render(<ReadAloudButton text="anything" />);
    await user.click(screen.getByRole("button"));
    const utterance = spoken[0];
    if (utterance?.onerror == null) throw new Error("no error handler");
    speaking = false;
    utterance.onerror();
    expect(await screen.findByRole("button", { name: "Read the problem aloud" })).toBeInTheDocument();
  });

  it("never leaves a voice talking over the next screen", async () => {
    installSpeech();
    const user = userEvent.setup();
    const { unmount } = render(<ReadAloudButton text="anything" />);
    await user.click(screen.getByRole("button"));
    unmount();
    expect(cancel).toHaveBeenCalled();
  });
});
