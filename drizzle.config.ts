import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit reads `.env`, but Next reads `.env.local` — so a DATABASE_URL
 * that works for the app would leave the migration CLI with an empty url.
 * Loading it here means one file serves both.
 */
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Not present, which is fine — the next one may be, or the variable may
    // already be set in the environment.
  }
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
