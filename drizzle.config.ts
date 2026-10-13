import { type Config } from "drizzle-kit";

import { env } from "@/env";

export default {
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations and Studio use the direct (non-pooled) connection. On Supabase
    // this is the 5432 endpoint; running them through the pgBouncer pooler is
    // unreliable. Falls back to DATABASE_URL when DIRECT_URL is unset (e.g. a
    // local Docker Postgres that has no separate direct URL).
    url: env.DIRECT_URL ?? env.DATABASE_URL,
  },
  tablesFilter: ["mm_web_*"],
} satisfies Config;
