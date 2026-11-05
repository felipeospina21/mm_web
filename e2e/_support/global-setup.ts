import { mkdir, writeFile } from "node:fs/promises";

import { chromium, type FullConfig } from "@playwright/test";

import { getE2eUserId } from "./db";
import {
  e2eConfig,
  E2E_STATE_DIR,
  E2E_STORAGE_STATE,
  E2E_USER_ID_FILE,
} from "./env";

/**
 * Global setup (Task 6.0):
 *   1. Resolve the seeded e2e user's id and persist it for teardown scoping.
 *   2. Sign in once via the credentials form and save `storageState`, so every
 *      spec starts authenticated (auth specs opt out).
 */
async function globalSetup(config: FullConfig) {
  const { userEmail, userPassword } = e2eConfig();
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3000";

  await mkdir(E2E_STATE_DIR, { recursive: true });

  // 1. Persist the e2e user id (throws with a clear message if not seeded).
  const userId = await getE2eUserId(userEmail);
  await writeFile(E2E_USER_ID_FILE, userId, "utf8");

  // 2. Produce the authenticated storage state.
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ baseURL });
    await page.goto("/login");
    await page.fill('input[name="email"]', userEmail);
    await page.fill('input[name="password"]', userPassword);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    // Credentials sign-in redirects to "/"; wait for the login form to go away.
    await page.waitForURL("**/");
    await page.context().storageState({ path: E2E_STORAGE_STATE });
  } finally {
    await browser.close();
  }
}

export default globalSetup;
