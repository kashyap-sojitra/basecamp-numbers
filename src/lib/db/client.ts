import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

let cached: NeonHttpDatabase<typeof schema> | null = null;

/** True when a database is configured, so callers can degrade gracefully. */
export function isDatabaseConfigured(): boolean {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;
}

/**
 * The Neon connection, created on first use rather than at import time — a
 * build with no `DATABASE_URL` set must still succeed.
 */
export function getDb(): NeonHttpDatabase<typeof schema> {
  if (cached !== null) return cached;

  const url = process.env.DATABASE_URL;
  if (url === undefined || url.length === 0) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon connection string.");
  }

  cached = drizzle(neon(url), { schema });
  return cached;
}
