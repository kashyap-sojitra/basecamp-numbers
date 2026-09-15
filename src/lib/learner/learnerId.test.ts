import { describe, expect, it, vi } from "vitest";
import {
  LEARNER_COOKIE,
  LEARNER_COOKIE_MAX_AGE,
  learnerCookieOptions,
  learnerIdSchema,
  newLearnerId,
} from "./learnerId";

describe("newLearnerId", () => {
  it("mints a valid UUID", () => {
    expect(learnerIdSchema.safeParse(newLearnerId()).success).toBe(true);
  });

  it("mints a different id every time", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newLearnerId()));
    expect(ids.size).toBe(200);
  });
});

describe("learnerIdSchema", () => {
  it("accepts a real UUID", () => {
    expect(learnerIdSchema.safeParse("3f2504e0-4f89-41d3-9a0c-0305e82c3301").success).toBe(true);
  });

  it("refuses anything that is not one, so a tampered cookie reads as no learner", () => {
    for (const bad of ["", "not-a-uuid", "3f2504e0", 42, null, undefined, {}]) {
      expect(learnerIdSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("learnerCookieOptions", () => {
  it("keeps the id out of page scripts entirely", () => {
    expect(learnerCookieOptions().httpOnly).toBe(true);
  });

  it("scopes the cookie to the whole site and survives a term away", () => {
    const options = learnerCookieOptions();
    expect(options.path).toBe("/");
    expect(options.sameSite).toBe("lax");
    expect(options.maxAge).toBe(LEARNER_COOKIE_MAX_AGE);
    expect(options.maxAge).toBeGreaterThanOrEqual(60 * 60 * 24 * 180);
  });

  it("is named so it cannot be confused with anything else", () => {
    expect(LEARNER_COOKIE).toBe("bn_learner");
  });
});

describe("the cookie's secure flag", () => {
  it("is set in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(learnerCookieOptions().secure).toBe(true);
  });

  it("is relaxed in development, where there is no TLS to be secure over", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(learnerCookieOptions().secure).toBe(false);
  });
});
