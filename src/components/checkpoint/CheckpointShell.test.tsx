import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CheckpointShell } from "./CheckpointShell";
import { CHECKPOINT_QUESTIONS } from "@/lib/domain/decay";
import { CAMP_DEFINITIONS } from "@/lib/data/camps";
import { jsonBodyOf } from "@test/requests";

const fetchMock = vi.fn<typeof fetch>();
const CAMP = CAMP_DEFINITIONS[0];

function shellFor(solved: number) {
  return render(
    <CheckpointShell camp={CAMP} theme="space" band="2-3" solved={solved}>
      <p>a question</p>
    </CheckpointShell>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ restored: true }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

describe("CheckpointShell: mid-review", () => {
  it("makes it obvious this is a review, not a new camp", () => {
    shellFor(0);
    expect(screen.getByText("Checkpoint")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Camp 1 · Trailhead" })).toBeInTheDocument();
    expect(
      screen.getByText(`${String(CHECKPOINT_QUESTIONS)} quick questions to bring this camp back up.`),
    ).toBeInTheDocument();
  });

  it("shows the question it is given", () => {
    shellFor(0);
    expect(screen.getByText("a question")).toBeInTheDocument();
  });

  it("counts progress through the review, in words as well as dots", () => {
    shellFor(1);
    expect(
      screen.getByLabelText(`1 of ${String(CHECKPOINT_QUESTIONS)} done`),
    ).toBeInTheDocument();
  });

  it("lets the child leave and come back", () => {
    shellFor(0);
    expect(screen.getByRole("link", { name: "Back to the map" })).toHaveAttribute("href", "/map");
    expect(screen.getByText(/the checkpoint will still be here/)).toBeInTheDocument();
  });

  it("restores nothing until the review is done", () => {
    shellFor(CHECKPOINT_QUESTIONS - 1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("CheckpointShell: review passed", () => {
  it("says the camp is bright again", () => {
    shellFor(CHECKPOINT_QUESTIONS);
    expect(screen.getByRole("heading", { name: "Camp 1 is bright again!" })).toBeInTheDocument();
  });

  it("stops asking questions", () => {
    shellFor(CHECKPOINT_QUESTIONS);
    expect(screen.queryByText("a question")).not.toBeInTheDocument();
  });

  it("restores the camp exactly once", async () => {
    shellFor(CHECKPOINT_QUESTIONS);
    await waitFor(() => { expect(fetchMock).toHaveBeenCalledTimes(1); });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/learner/checkpoint");
    expect(init?.method).toBe("POST");
    expect(jsonBodyOf(init)).toEqual({ camp: 1 });
  });

  it("shows a loader while the restore is in flight, not a bare screen", () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));
    shellFor(CHECKPOINT_QUESTIONS);
    expect(screen.getByLabelText("Writing your word problem")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Back to the map" })).not.toBeInTheDocument();
  });

  it("confirms the meter is back once the restore lands", async () => {
    shellFor(CHECKPOINT_QUESTIONS);
    expect(
      await screen.findByText("Its Mastery Meter is back where you earned it. The way up is open."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the map" })).toBeInTheDocument();
  });

  it("says so honestly when the restore could not be saved", async () => {
    fetchMock.mockResolvedValue(new Response("no", { status: 503 }));
    shellFor(CHECKPOINT_QUESTIONS);
    expect(await screen.findByText(/could not save it/)).toBeInTheDocument();
  });

  it("recovers from a network failure rather than hanging", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    shellFor(CHECKPOINT_QUESTIONS);
    expect(await screen.findByText(/could not save it/)).toBeInTheDocument();
  });

  it("still credits the child for the review it cannot save", async () => {
    fetchMock.mockResolvedValue(new Response("no", { status: 503 }));
    shellFor(CHECKPOINT_QUESTIONS);
    await screen.findByText(/could not save it/);
    expect(screen.getByRole("heading", { name: "Camp 1 is bright again!" })).toBeInTheDocument();
  });
});
