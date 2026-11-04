import { readFileSync } from "node:fs";

import { test as base } from "@playwright/test";

import { deleteE2eClientsForUser, deleteQuotationsForUser } from "./db";
import { E2E_USER_ID_FILE } from "./env";

/**
 * Shared e2e fixtures (Task 6.0).
 *
 * - `e2eUserId`: the seeded e2e user's id (resolved in global setup).
 * - `trackCreated`: specs that write rows push the created ids here; `afterEach`
 *   deletes exactly those. Global teardown is the crash backstop.
 *
 * Cleanup is always scoped to the e2e user; `trackCreated` records ids only for
 * clarity/assertions — the delete filters by `user_id` regardless.
 */

interface Created {
  quotationIds: string[];
  /** Set when a spec created an `[E2E]`-tagged client. */
  createdClient: boolean;
}

interface Fixtures {
  e2eUserId: string;
  created: Created;
}

export const test = base.extend<Fixtures>({
  e2eUserId: async ({}, use) => {
    const userId = readFileSync(E2E_USER_ID_FILE, "utf8").trim();
    await use(userId);
  },

  created: async ({ e2eUserId }, use) => {
    const created: Created = { quotationIds: [], createdClient: false };
    await use(created);

    // Per-test cleanup, scoped to the e2e user.
    if (created.quotationIds.length > 0) {
      await deleteQuotationsForUser(e2eUserId);
    }
    if (created.createdClient) {
      await deleteE2eClientsForUser(e2eUserId);
    }
  },
});

export { expect } from "@playwright/test";
