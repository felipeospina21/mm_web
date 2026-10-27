/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Self-contained server bundle. Harmless on Vercel (which handles output
  // itself); kept so the app can also be built/run standalone if needed.
  output: "standalone",
  // Pin the workspace root: a stray pnpm-lock.yaml in ~/ makes Next
  // infer the wrong root otherwise.
  outputFileTracingRoot: import.meta.dirname,
  // Keep native/server-only packages external so they are never bundled
  // (loaded from node_modules at runtime instead). Correct default for
  // native addons like argon2 and the postgres driver.
  serverExternalPackages: ["argon2", "postgres"],
};

export default config;
