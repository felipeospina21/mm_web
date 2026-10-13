import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/env";
import * as schema from "./schema";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

/**
 * `prepare: false` disables prepared statements, which is required when the app
 * connects through Supabase's pgBouncer pooler in transaction mode. It is a
 * no-op on a plain Postgres (Docker) connection, so the same client works for
 * every environment without branching.
 */
const conn = globalForDb.conn ?? postgres(env.DATABASE_URL, { prepare: false });
if (env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
