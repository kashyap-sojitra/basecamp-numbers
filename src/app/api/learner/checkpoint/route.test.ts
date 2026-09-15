import { beforeEach, describe, expect, it, vi } from "vitest";

let configured = true;
vi.mock("@/lib/db/client", () => ({ isDatabaseConfigured: () => configured }));

const refreshCamp = vi.fn<() => Promise<boolean>>();
vi.mock("@/lib/db/learnerRepository", () => ({ refreshCamp }));

const readLearnerId = vi.fn<() => Promise<string | null>>();
vi.mock("@/lib/learner/session", () => ({ readLearnerId }));

const { POST } = await import("./route");

const LEARNER = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function post(body: unknown): Request {
  return new Request("http://localhost/api/learner/checkpoint", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  configured = true;
  refreshCamp.mockReset().mockResolvedValue(true);
  readLearnerId.mockReset().mockResolvedValue(LEARNER);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/learner/checkpoint", () => {
  it("restores the reviewed camp", async () => {
    const response = await POST(post({ camp: 2 }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ restored: true });
    expect(refreshCamp).toHaveBeenCalledWith(LEARNER, 2);
  });

  it("accepts every one of the four camps", async () => {
    for (const camp of [1, 2, 3, 4]) {
      expect((await POST(post({ camp }))).status).toBe(200);
    }
    expect(refreshCamp).toHaveBeenCalledTimes(4);
  });

  it("refuses a camp outside the four", async () => {
    for (const camp of [0, 5, "2", null]) {
      const response = await POST(post({ camp }));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "Expected a camp number" });
    }
    expect(refreshCamp).not.toHaveBeenCalled();
  });

  it("refuses a body that is not JSON", async () => {
    expect((await POST(post("nope"))).status).toBe(400);
  });

  it("says so when no database is configured", async () => {
    configured = false;
    const response = await POST(post({ camp: 1 }));
    expect(response.status).toBe(503);
    expect(refreshCamp).not.toHaveBeenCalled();
  });

  it("refuses a request with no learner on it", async () => {
    readLearnerId.mockResolvedValue(null);
    expect((await POST(post({ camp: 1 }))).status).toBe(401);
  });

  it("reports a failed restore honestly", async () => {
    refreshCamp.mockResolvedValue(false);
    await expect((await POST(post({ camp: 1 }))).json()).resolves.toEqual({ restored: false });
  });
});
