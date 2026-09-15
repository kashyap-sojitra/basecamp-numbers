import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn<(name: string) => { value: string } | undefined>();

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get }),
}));

const { readLearnerId } = await import("./session");
const { LEARNER_COOKIE } = await import("./learnerId");

describe("readLearnerId", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("returns the learner in the cookie", async () => {
    const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    get.mockReturnValue({ value: id });
    await expect(readLearnerId()).resolves.toBe(id);
    expect(get).toHaveBeenCalledWith(LEARNER_COOKIE);
  });

  it("returns null for a first-time visitor with no cookie", async () => {
    get.mockReturnValue(undefined);
    await expect(readLearnerId()).resolves.toBeNull();
  });

  it("returns null rather than trusting a hand-edited cookie", async () => {
    for (const tampered of ["", "1; drop table learners", "../../etc/passwd", "42"]) {
      get.mockReturnValue({ value: tampered });
      await expect(readLearnerId()).resolves.toBeNull();
    }
  });
});
