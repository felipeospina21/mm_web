/**
 * Temporary feature flags.
 *
 * Each flag is a plain constant so releasing a feature is a deletion, not a
 * config change: remove the constant, then remove every reference (grep the
 * name) and keep the "on" branch.
 */

/**
 * "Mis cotizaciones" (`/my-quotations`): visible only under `next dev`
 * (local + e2e). Every Vercel deployment — previews included — runs with
 * `NODE_ENV=production`, so it stays hidden there. `NODE_ENV` is inlined at
 * build time, so this is safe to read from client components too.
 *
 * To release: delete this constant and its references.
 */
export const FEATURE_MY_QUOTATIONS = process.env.NODE_ENV === "development";
