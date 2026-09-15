import { beforeEach, describe, expect, it, vi } from "vitest";
import { todayLocalDate } from "@/lib/domain/localDate";

/* -------------------------------------------------------------------------- */

interface CookieOptions {
  readonly httpOnly: boolean;
  readonly sameSite: string;
  readonly path: string;
}

const cookieStore = {
  get: vi.fn<(name: string) => { value: string } | undefined>(),
  set: vi.fn<(name: string, value: string, options: CookieOptions) => void>(),
};
vi.mock("next/headers", () => ({ cookies: () => Promise.resolve(cookieStore) }));

let configured = true;
vi.mock("@/lib/db/client", () => ({ isDatabaseConfigured: () => configured }));

const saveProfile = vi.fn<() => Promise<boolean>>();
const recordSolve = vi.fn<(learner: string, solve: unknown) => Promise<boolean>>();
vi.mock("@/lib/db/learnerRepository", () => ({ saveProfile, recordSolve }));

const readLearnerId = vi.fn<() => Promise<string | null>>();
vi.mock("@/lib/learner/session", () => ({ readLearnerId }));

const { PATCH, POST } = await import("./route");
const { LEARNER_COOKIE } = await import("@/lib/learner/learnerId");

const LEARNER = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function post(body: unknown): Request {
  return new Request("http://localhost/api/learner", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function patch(body: unknown): Request {
  return new Request("http://localhost/api/learner", {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  configured = true;
  cookieStore.get.mockReset();
  cookieStore.set.mockReset();
  saveProfile.mockReset().mockResolvedValue(true);
  recordSolve.mockReset().mockResolvedValue(true);
  readLearnerId.mockReset().mockResolvedValue(LEARNER);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

/* -------------------------------------------------------------------------- */

describe("POST /api/learner", () => {
  const PICKS = { gradeBand: "2-3", interestTheme: "ocean" };

  it("saves both picks", async () => {
    const response = await POST(post(PICKS));
    expect(response.status).toBe(200);
    await expect(bodyOf(response)).resolves.toEqual({ saved: true });
    expect(saveProfile).toHaveBeenCalledWith(LEARNER, PICKS);
  });

  it("mints a learner cookie on a first visit", async () => {
    readLearnerId.mockResolvedValue(null);
    await POST(post(PICKS));
    expect(cookieStore.set).toHaveBeenCalledOnce();
    const [name, value, options] = cookieStore.set.mock.calls[0] ?? [];
    expect(name).toBe(LEARNER_COOKIE);
    expect(value).toMatch(/^[0-9a-f-]{36}$/);
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("does not re-mint a cookie for a returning learner", async () => {
    await POST(post(PICKS));
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("keeps one identity for the visit even when the write fails", async () => {
    readLearnerId.mockResolvedValue(null);
    saveProfile.mockResolvedValue(false);
    const response = await POST(post(PICKS));
    await expect(bodyOf(response)).resolves.toEqual({ saved: false });
    expect(cookieStore.set).toHaveBeenCalledOnce();
  });

  it("refuses a body missing a pick", async () => {
    for (const bad of [{}, { gradeBand: "2-3" }, { interestTheme: "ocean" }]) {
      const response = await POST(post(bad));
      expect(response.status).toBe(400);
      await expect(bodyOf(response)).resolves.toEqual({
        error: "Expected a grade band and an interest theme",
      });
    }
  });

  it("refuses picks outside the allowed values", async () => {
    const response = await POST(post({ gradeBand: "grade-9", interestTheme: "desert" }));
    expect(response.status).toBe(400);
  });

  it("refuses a body that is not JSON at all", async () => {
    expect((await POST(post("not json"))).status).toBe(400);
  });

  it("says what to do when no database is configured", async () => {
    configured = false;
    const response = await POST(post(PICKS));
    expect(response.status).toBe(503);
    const body = await bodyOf(response);
    expect(String(body.error)).toContain(".env.local");
    expect(String(body.error)).toContain("db:migrate");
    expect(saveProfile).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/learner", () => {
  const SOLVE = { camp: 1, clean: true, localDate: "2026-09-11" };

  it("records the solve with the day and cleanness the client sent", async () => {
    const response = await PATCH(patch(SOLVE));
    expect(response.status).toBe(200);
    await expect(bodyOf(response)).resolves.toEqual({ saved: true });
    expect(recordSolve).toHaveBeenCalledWith(LEARNER, {
      camp: 1,
      clean: true,
      localDate: "2026-09-11",
    });
  });

  it("will not take a meter from the client, however it is asked", async () => {
    // The hole this closed: the client used to send the resulting meter and the
    // server wrote it down, so one request could fill any camp — or every camp.
    for (const mastery of [100, 99, 1, 0, -5, 1000, "100", null]) {
      recordSolve.mockClear();
      const response = await PATCH(patch({ ...SOLVE, mastery }));
      // A sane value is tolerated for a tab that was already open; a silly one
      // is refused outright. Either way it never reaches the database.
      if (response.status === 200) {
        expect(recordSolve.mock.calls[0]?.[1]).not.toHaveProperty("mastery");
      } else {
        expect(response.status).toBe(400);
        expect(recordSolve).not.toHaveBeenCalled();
      }
    }
  });

  it("defaults a solve with no cleanness to not clean", async () => {
    await PATCH(patch({ camp: 1, localDate: "2026-09-11" }));
    expect(recordSolve.mock.calls[0]?.[1]).toMatchObject({ clean: false });
  });

  it("falls back to the server's day for an older client that sends none", async () => {
    await PATCH(patch({ camp: 2 }));
    expect(recordSolve.mock.calls[0]?.[1]).toMatchObject({ localDate: todayLocalDate() });
  });

  it("refuses a camp outside the four", async () => {
    for (const camp of [0, 5, -1, "1"]) {
      const response = await PATCH(patch({ ...SOLVE, camp }));
      expect(response.status).toBe(400);
    }
    expect(recordSolve).not.toHaveBeenCalled();
  });

  it("refuses a meter reading off the meter", async () => {
    for (const mastery of [-1, 101, 1.5]) {
      expect((await PATCH(patch({ ...SOLVE, mastery }))).status).toBe(400);
    }
  });

  it("refuses a day that does not exist", async () => {
    for (const localDate of ["2026-02-30", "yesterday", "2026-13-01"]) {
      expect((await PATCH(patch({ ...SOLVE, localDate }))).status).toBe(400);
    }
  });

  it("refuses a request with no learner on it", async () => {
    readLearnerId.mockResolvedValue(null);
    const response = await PATCH(patch(SOLVE));
    expect(response.status).toBe(401);
    await expect(bodyOf(response)).resolves.toEqual({ error: "No learner on this request" });
  });

  it("says so when no database is configured", async () => {
    configured = false;
    expect((await PATCH(patch(SOLVE))).status).toBe(503);
  });

  it("reports a failed write honestly rather than claiming success", async () => {
    recordSolve.mockResolvedValue(false);
    const response = await PATCH(patch(SOLVE));
    expect(response.status).toBe(200);
    await expect(bodyOf(response)).resolves.toEqual({ saved: false });
  });

  it("refuses a body that is not JSON", async () => {
    expect((await PATCH(patch("{{{"))).status).toBe(400);
  });

  it("refuses to send a response that fails its own schema", async () => {
    // A bug in the repository must not become a bad payload on the wire.
    recordSolve.mockResolvedValue("yes" as unknown as boolean);
    const response = await PATCH(patch(SOLVE));
    expect(response.status).toBe(500);
    await expect(bodyOf(response)).resolves.toEqual({
      error: "Internal response validation failed",
    });
  });
});
