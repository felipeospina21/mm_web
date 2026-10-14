import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Vitest config for server-side unit tests (no DOM).
 *
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
    include: ["src/**/*.test.ts"],
    env: {
      SKIP_ENV_VALIDATION: "1",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/mm_web",
      EXTERNAL_API_BASE_URL: "https://api.example.test/v1",
      EXTERNAL_API_TOKEN: "test-token",
    },
  },
});
