/**
 * E2E env resolution (Task 6.0). The `test:e2e` script wraps the run in
 * `dotenv -e .env.development`, so DB + app vars are already in `process.env`.
 * These helpers surface the e2e-only credentials with clear errors when unset.
 */

export interface E2eConfig {
  userEmail: string;
  userPassword: string;
}

export function e2eConfig(): E2eConfig {
  const userEmail = process.env.E2E_USER_EMAIL;
  const userPassword = process.env.E2E_USER_PASSWORD;

  if (!userEmail || !userPassword) {
    throw new Error(
      "E2E setup: set E2E_USER_EMAIL and E2E_USER_PASSWORD in .env.development, " +
        'then seed the user: pnpm db:seed:dev "$E2E_USER_EMAIL" "$E2E_USER_PASSWORD" "E2E User"',
    );
  }

  return { userEmail, userPassword };
}

/** Where global setup stashes the resolved e2e user id for teardown scoping. */
export const E2E_STATE_DIR = "./e2e/.auth";
export const E2E_USER_ID_FILE = `${E2E_STATE_DIR}/user-id.txt`;
export const E2E_STORAGE_STATE = `${E2E_STATE_DIR}/state.json`;
