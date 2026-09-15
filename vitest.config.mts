import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Test setup for Basecamp Numbers.
 *
 * One runner for every layer: the pure domain rules, the API routes, the
 * database repository and the React components. jsdom is the default
 * environment so a component test needs no ceremony, and the pure rules do
 * not care either way.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@test": fileURLToPath(new URL("./test", import.meta.url)),
      /*
       * `<ViewTransition>` exists only in the React canary that Next vendors
       * and runs the app on, not in the `react` in package.json. Tests keep a
       * single React — the installed one — and get the missing export from a
       * shim. Order matters: Vite matches these as prefixes, so "react-actual"
       * has to resolve before the bare "react" is rewritten.
       */
      "react-actual": fileURLToPath(
        new URL("./node_modules/react/index.js", import.meta.url),
      ),
      // The JSX runtimes must keep pointing at the real React, or the prefix
      // match below rewrites them into the shim's path.
      "react/jsx-runtime": fileURLToPath(
        new URL("./node_modules/react/jsx-runtime.js", import.meta.url),
      ),
      "react/jsx-dev-runtime": fileURLToPath(
        new URL("./node_modules/react/jsx-dev-runtime.js", import.meta.url),
      ),
      react: fileURLToPath(new URL("./test/reactShim.js", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/serverOnlyStub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    restoreMocks: true,
    unstubEnvs: true,
    /*
     * The default 5s leaves the invariant sweeps almost no head-room. They are
     * deliberately heavy — the difficulty ladder alone generates 400 problems
     * per band × skill × level — and the slowest sits near 3s on a dev machine.
     * A shared CI runner is several times slower, so under coverage these timed
     * out rather than failed. The ceiling goes up because the sweeps are the
     * proof the generators hold; shortening them would spend that proof to buy
     * back seconds.
     */
    testTimeout: 60_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        // Type-only modules compile to nothing, so v8 reports them as 0/0.
        "src/lib/ai/types.ts",
      ],
      /*
       * The floor, not the target. Actuals sit around 99% of lines and 93%
       * of branches; these are set just below so an honest refactor does not
       * fail the build while a genuine gap does. Raise them, never lower.
       */
      thresholds: {
        statements: 97,
        lines: 98,
        functions: 97,
        branches: 92,
      },
    },
  },
});
