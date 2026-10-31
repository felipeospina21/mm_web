#!/usr/bin/env node
// @ts-check
/**
 * `pnpm ship` — cut a release AND deploy to production in one command.
 *
 * Chains, fail-fast, with the irreversible step last:
 *   1. guard   — must be on `main`, clean tree, up to date with origin
 *   2. release — `commit-and-tag-version` (bump + CHANGELOG + commit + tag)
 *   3. push    — `git push --follow-tags origin main`
 *   4. notes   — `gh release create vX.Y.Z --generate-notes`
 *   5. deploy  — `vercel --prod`
 *
 * Pushing the release commit to `main` relies on the repo ruleset's admin
 * bypass, so this is an **owner-only** command. If any step fails, the rest do
 * not run.
 *
 * Flags:
 *   --dry-run        Preview the release (no files, no push, no deploy).
 *   --yes            Skip the confirmation prompt.
 *   --release-as X   Force the bump (patch | minor | major | <version>).
 */
import { execSync, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const dryRun = has("--dry-run");
const skipConfirm = has("--yes");
const releaseAsIndex = args.indexOf("--release-as");
const releaseAs =
  releaseAsIndex >= 0 ? args[releaseAsIndex + 1] : undefined;

/** Run a command, inheriting stdio; throw (fail-fast) on non-zero exit. */
function run(command, commandArgs) {
  const printed = [command, ...commandArgs].join(" ");
  console.log(`\n\u001b[36m▶ ${printed}\u001b[0m`);
  const result = spawnSync(command, commandArgs, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`Step failed (exit ${result.status}): ${printed}`);
  }
}

/** Capture stdout of a command (trimmed). */
function capture(command) {
  return execSync(command, { encoding: "utf8" }).trim();
}

function guard() {
  const branch = capture("git rev-parse --abbrev-ref HEAD");
  if (branch !== "main") {
    throw new Error(`Must be on 'main' to ship (currently on '${branch}').`);
  }
  const dirty = capture("git status --porcelain");
  if (dirty) {
    throw new Error("Working tree is not clean. Commit or stash first.");
  }
  // Ensure local main matches origin/main (don't tag the wrong commit).
  execSync("git fetch origin main", { stdio: "ignore" });
  const local = capture("git rev-parse @");
  const remote = capture("git rev-parse @{u}");
  if (local !== remote) {
    throw new Error(
      "Local 'main' is not in sync with origin/main. Pull/push first.",
    );
  }
}

async function confirm() {
  if (skipConfirm) return;
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(
    "\n\u001b[33mThis will cut a release AND deploy to PRODUCTION. Continue? (y/N) \u001b[0m",
  );
  rl.close();
  if (answer.trim().toLowerCase() !== "y") {
    console.log("Aborted.");
    process.exit(1);
  }
}

async function main() {
  // --- dry run: just preview the release, skip guards/push/deploy ----------
  if (dryRun) {
    const extra = releaseAs ? ["--release-as", releaseAs] : [];
    run("pnpm", ["release:dry", ...extra]);
    console.log(
      "\n\u001b[36mDry run complete — nothing was committed, pushed, or deployed.\u001b[0m",
    );
    return;
  }

  guard();
  await confirm();

  // 1. Release (bump + CHANGELOG + commit + tag). No push yet.
  const releaseArgs = ["release"];
  if (releaseAs) releaseArgs.push("--", "--release-as", releaseAs);
  run("pnpm", releaseArgs);

  // 2. Publish the release commit + tag.
  run("git", ["push", "--follow-tags", "origin", "main"]);

  // 3. GitHub release notes from the freshly-created tag.
  const version = capture(`node -p "require('./package.json').version"`);
  const tag = `v${version}`;
  run("gh", ["release", "create", tag, "--generate-notes"]);

  // 4. Deploy to production (last — the only irreversible step).
  run("vercel", ["--prod"]);

  console.log(`\n\u001b[32m✔ Shipped ${tag} and deployed to production.\u001b[0m`);
}

main().catch((error) => {
  console.error(`\n\u001b[31m✖ ${error.message}\u001b[0m`);
  console.error(
    "Nothing further ran. Fix the issue and re-run, or complete the remaining steps manually (see RELEASING.md).",
  );
  process.exit(1);
});
