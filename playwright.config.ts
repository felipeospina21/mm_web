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
    // Call the dev chain directly (not via `pnpm dev:db:dev`) so the `-p` flag
    // reaches `next dev` with a single `--` separator — routing the port
    // through the pnpm script produced a double `--` that broke arg parsing.
    // Mirrors `dev:db:dev` (same `.env.local` loader). `E2E_PORT` moves the app
    // off a busy 3000 (e.g. another local server).
    command: `dotenv -e .env.local -- next dev -p ${PORT}`,
    url: BASE_URL,
    timeout: 120_000,
    // Always boot our own app rather than hijacking an unrelated server.
    reuseExistingServer: false,
  },
});
