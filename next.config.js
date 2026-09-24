/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Produce a self-contained server bundle for slim Docker images.
  output: "standalone",
  // Pin the workspace root: a stray pnpm-lock.yaml in ~/ makes Next
  // infer the wrong root otherwise.
  outputFileTracingRoot: import.meta.dirname,
};

export default config;
