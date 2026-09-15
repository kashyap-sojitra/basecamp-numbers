import { afterEach, describe, expect, it, vi } from "vitest";

const neon = vi.fn(() => "sql-client");
const drizzle = vi.fn(() => ({ db: true }));

vi.mock("@neondatabase/serverless", () => ({ neon }));
vi.mock("drizzle-orm/neon-http", () => ({ drizzle }));

const URL = "postgresql://user:pass@host.neon.tech/neondb?sslmode=require";

describe("isDatabaseConfigured", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("is true when a connection string is set", async () => {
    vi.stubEnv("DATABASE_URL", URL);
    const { isDatabaseConfigured } = await import("./client");
    expect(isDatabaseConfigured()).toBe(true);
  });

  it("is false when the variable is missing entirely", async () => {
    vi.stubEnv("DATABASE_URL", undefined);
    const { isDatabaseConfigured } = await import("./client");
    expect(isDatabaseConfigured()).toBe(false);
  });

  it("is false for an empty string, so a blank .env reads as unconfigured", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { isDatabaseConfigured } = await import("./client");
    expect(isDatabaseConfigured()).toBe(false);
  });
});

describe("getDb", () => {
  afterEach(() => {
    vi.resetModules();
    neon.mockClear();
    drizzle.mockClear();
  });

  it("connects with the configured URL", async () => {
    vi.stubEnv("DATABASE_URL", URL);
    const { getDb } = await import("./client");
    getDb();
    expect(neon).toHaveBeenCalledWith(URL);
    expect(drizzle).toHaveBeenCalledTimes(1);
  });

  it("connects once and reuses the connection", async () => {
    vi.stubEnv("DATABASE_URL", URL);
    const { getDb } = await import("./client");
    const first = getDb();
    const second = getDb();
    expect(second).toBe(first);
    expect(drizzle).toHaveBeenCalledTimes(1);
  });

  it("does not connect at import time, so a build without a URL still succeeds", async () => {
    vi.stubEnv("DATABASE_URL", undefined);
    await import("./client");
    expect(neon).not.toHaveBeenCalled();
  });

  it("throws an actionable error when asked to connect with no URL", async () => {
    vi.stubEnv("DATABASE_URL", undefined);
    const { getDb } = await import("./client");
    expect(() => getDb()).toThrow(/DATABASE_URL is not set/);
    expect(() => getDb()).toThrow(/\.env\.local/);
  });
});
