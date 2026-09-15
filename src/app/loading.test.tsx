import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import RootLoading from "./loading";
import MapLoading from "./map/loading";
import LogLoading from "./log/loading";
import CampLoading from "./camp/[camp]/loading";
import CheckpointLoading from "./checkpoint/[camp]/loading";

/**
 * Every route has a loader, per CLAUDE.md — nothing ever just sits blank.
 * These are the Suspense boundaries Next renders while a page's data loads.
 */
const LOADERS = [
  { name: "the entry page", Loading: RootLoading },
  { name: "the map", Loading: MapLoading },
  { name: "the climb log", Loading: LogLoading },
  { name: "a camp", Loading: CampLoading },
  { name: "a checkpoint", Loading: CheckpointLoading },
] as const;

describe("route loaders", () => {
  it("every route has one", () => {
    expect(LOADERS).toHaveLength(5);
  });

  for (const { name, Loading } of LOADERS) {
    it(`says what is happening while waiting for ${name}`, () => {
      const { unmount } = render(<Loading />);
      expect(screen.getByRole("main")).toBeInTheDocument();
      // A loader with no words is just a blank screen with a spinner on it.
      expect(screen.getByRole("main").textContent.trim().length).toBeGreaterThan(3);
      unmount();
    });
  }

  it("gives each route its own wording, so the wait tells you where you are", () => {
    const labels = LOADERS.map(({ Loading }) => {
      const { container, unmount } = render(<Loading />);
      const { textContent: text } = container;
      unmount();
      return text;
    });
    expect(new Set(labels).size).toBe(LOADERS.length);
  });
});
