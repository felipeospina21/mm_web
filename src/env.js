import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    AUTH_MICROSOFT_ENTRA_ID_ID:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    AUTH_MICROSOFT_ENTRA_ID_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    AUTH_MICROSOFT_ENTRA_ID_ISSUER:
      process.env.NODE_ENV === "production"
        ? z.string().url()
        : z.string().url().optional(),
    /**
     * Pooled connection string used by the running app. On Supabase this is the
     * pgBouncer pooler (port 6543). On a local Docker Postgres it is the plain
     * connection string — both work with the same `postgres-js` client.
     */
    DATABASE_URL: z.string().url(),
    /**
     * Direct (non-pooled) connection string used ONLY for migrations and
     * Drizzle Studio (Supabase port 5432). Optional: when unset, migration
     * tooling falls back to `DATABASE_URL`. Running migrations through the
     * pgBouncer pooler is unreliable, so set this in any Supabase environment.
     */
    DIRECT_URL: z.string().url().optional(),
    /**
     * Base URL of the external product aggregator API (no trailing slash),
     * e.g. `https://api.example.com/v1`. The SKU lookup issues
     * `GET {EXTERNAL_API_BASE_URL}/products?skus=a,b,c`.
     */
    EXTERNAL_API_BASE_URL:
      process.env.NODE_ENV === "production"
        ? z.string().url()
        : z.string().url().optional(),
    /**
     * Bearer token / API key for the external product API, sent as
     * `Authorization: Bearer <token>`. Required in production; optional in
     * dev/test so the app still boots before the integration is configured.
     */
    EXTERNAL_API_TOKEN:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_MICROSOFT_ENTRA_ID_ID: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
    AUTH_MICROSOFT_ENTRA_ID_SECRET:
      process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
    AUTH_MICROSOFT_ENTRA_ID_ISSUER:
      process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    EXTERNAL_API_BASE_URL: process.env.EXTERNAL_API_BASE_URL,
    EXTERNAL_API_TOKEN: process.env.EXTERNAL_API_TOKEN,
    NODE_ENV: process.env.NODE_ENV,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
