import { readFile } from "node:fs/promises";

import {
  closeDb,
  deleteE2eClientsForUser,
  deleteQuotationsForUser,
} from "./db";
import { E2E_USER_ID_FILE } from "./env";

/**
 * Global teardown (Task 6.0): backstop sweep of anything a crashed spec leaked,
 * scoped to the e2e user's id. Per-test `afterEach` is the first line of
 * defence (see fixtures); this guarantees a clean DB even if a run aborts.
 */
async function globalTeardown() {
  let userId: string;
  try {
    userId = (await readFile(E2E_USER_ID_FILE, "utf8")).trim();
  } catch {
    // Setup never resolved a user id — nothing was created, nothing to sweep.
    await closeDb();
    return;
  }

  if (!userId) {
    await closeDb();
    return;
  }

  const quotations = await deleteQuotationsForUser(userId);
  const e2eClients = await deleteE2eClientsForUser(userId);
  if (quotations || e2eClients) {
    console.log(
      `[e2e teardown] swept ${quotations} quotation(s), ${e2eClients} [E2E] client(s) for user ${userId}`,
    );
  }

  await closeDb();
}

export default globalTeardown;
