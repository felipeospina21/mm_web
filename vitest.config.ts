import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Vitest config.
 *
 * - Default `environment: "node"` for server/pure unit tests (no DOM).
 * - `.test.tsx` files run under **jsdom** (React component / hook tests via
 *   React Testing Library) by declaring `// @vitest-environment jsdom` at the
 *   top of the file — so the node tests are unaffected.
 * - `@/*` path alias mirrors tsconfig so imports resolve the same way.
 * - `server-only` is aliased to an empty module: it throws if imported into a
 *   client bundle, but under Node/Vitest there is no such guard to satisfy.
 * - Env vars the validated `@/env` module requires are provided here so that
 *   importing server modules under test does not fail env validation.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./src/test/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text"],
      // Focus the report on the editor — the area this coverage effort targets.
      // No failing `thresholds` yet (would gate CI on a still-rising number and
      // on editor-client.tsx, deferred); run `pnpm test:coverage` to measure.
      // Baseline after Task 3.7: ~46% editor statements (was ~13%).
      include: ["src/app/editor/**"],
    },
    env: {
      SKIP_ENV_VALIDATION: "1",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/mm_web",
      EXTERNAL_API_BASE_URL: "https://api.example.test/v1",
      EXTERNAL_API_TOKEN: "test-token",
    },
  },
});
