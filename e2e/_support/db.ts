import postgres from "postgres";

/**
 * E2E DB-cleanup harness (Task 6.0). A direct `postgres` client over
 * `DIRECT_URL` (falling back to `DATABASE_URL`) — NOT the app's pooled client —
 * used only by global setup/teardown and per-test cleanup.
 *
 * SAFETY: every delete is scoped to the e2e user's `id`. Never run a bare
 * `LIKE` or an unscoped delete here — that is the one hard rule for touching the
 * shared dev DB.
 */

const connectionString = () =>
  process.env.DIRECT_URL ?? process.env.DATABASE_URL;

/** Lazily-created singleton so setup, specs, and teardown share one pool. */
let client: ReturnType<typeof postgres> | null = null;

function db() {
  if (!client) {
    const url = connectionString();
    if (!url) {
      throw new Error(
        "E2E db harness: set DIRECT_URL (or DATABASE_URL) in .env.local",
      );
    }
    client = postgres(url, { max: 2, prepare: false });
  }
  return client;
}

/** Close the pool (call from global teardown). */
export async function closeDb(): Promise<void> {
  if (client) {
    await client.end({ timeout: 5 });
    client = null;
  }
}

/** Resolve the e2e user's id from its email. Throws if the user isn't seeded. */
export async function getE2eUserId(email: string): Promise<string> {
  const rows = await db()<{ id: string }[]>`
    SELECT id FROM mm_web_user WHERE email = ${email} LIMIT 1
  `;
  const id = rows[0]?.id;
  if (!id) {
    throw new Error(
      `E2E user "${email}" not found. Seed it first: pnpm db:seed:dev "${email}" "<password>" "E2E User"`,
    );
  }
  return id;
}

/** Delete every quotation owned by the e2e user. Scoped by user_id. */
export async function deleteQuotationsForUser(userId: string): Promise<number> {
  const result = await db()`
    DELETE FROM mm_web_quotation WHERE user_id = ${userId}
  `;
  return result.count;
}

/**
 * Delete the e2e user's `[E2E]`-tagged clients (contacts cascade via FK).
 * Double-scoped: user_id AND the `[E2E]%` sentinel, so untagged clients are
 * never touched even within the e2e user's data.
 *
 * `ILIKE`, not `LIKE`: `customer.create` lowercases the name, so a client
 * created through the UI as "[E2E] …" is stored as "[e2e] …" (found in 6.3).
 */
export async function deleteE2eClientsForUser(userId: string): Promise<number> {
  const result = await db()`
    DELETE FROM mm_web_client
    WHERE user_id = ${userId} AND name ILIKE '[E2E]%'
  `;
  return result.count;
}

/** Count helper for the acceptance check (rows before/after teardown). */
export async function countE2eRowsForUser(userId: string): Promise<{
  quotations: number;
  e2eClients: number;
}> {
  const [q] = await db()<{ n: number }[]>`
    SELECT count(*)::int AS n FROM mm_web_quotation WHERE user_id = ${userId}
  `;
  const [c] = await db()<{ n: number }[]>`
    SELECT count(*)::int AS n FROM mm_web_client
    WHERE user_id = ${userId} AND name ILIKE '[E2E]%'
  `;
  return { quotations: q?.n ?? 0, e2eClients: c?.n ?? 0 };
}

/** A saved quotation row, for asserting what Save persisted (Task 6.3). */
export interface E2eQuotationRow {
  id: string;
  quotationNumber: string;
  clientId: string | null;
  productCount: number;
  references: string[] | null;
}

/** The e2e user's quotations (scoped by user_id). */
export async function getQuotationsForUser(
  userId: string,
): Promise<E2eQuotationRow[]> {
  return db()<E2eQuotationRow[]>`
    SELECT id, quotation_number AS "quotationNumber", client_id AS "clientId",
           product_count AS "productCount", "references"
    FROM mm_web_quotation WHERE user_id = ${userId}
  `;
}
