import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config (Task 6.0). Separate from Vitest: tests live in `e2e/`, require a
 * running app + Supabase **dev** DB + a mocked external API, and run via
 * `pnpm test:e2e` (never as part of `pnpm test`).
 *
 * Env comes from `.env.development` (loaded by the `dotenv -e` wrapper in the
 * `test:e2e` script) plus the e2e-only vars documented in `.env.example`
 * (`E2E_USER_EMAIL`, `E2E_USER_PASSWORD`).
 */
const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  // Serial by default: the suite shares one dev DB + one e2e user, so avoid
  // cross-worker races until specs prove they're isolation-safe.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",

  globalSetup: "./e2e/_support/global-setup.ts",
  globalTeardown: "./e2e/_support/global-teardown.ts",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    // Signed-in state produced once in global setup and reused by specs.
    // Auth specs (6.6) opt out via `test.use({ storageState: undefined })`.
    storageState: "./e2e/.auth/state.json",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    // Reuse the existing env-loading dev script so the app and the harness read
    // the same `.env.development`.
    command: "pnpm dev:db:dev",
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
