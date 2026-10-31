# Releasing

This project is a **deployed app** (not a published library), so versioning is
for **traceability, rollback, and changelog** — not an API contract.

- **Scheme:** loose [semver](https://semver.org/) while in `0.x` (pre-stable).
  The version is **inferred from Conventional Commit messages** via
  [`commit-and-tag-version`](https://github.com/absolute-version/commit-and-tag-version):
  - `feat:` and `fix:` → **patch** bump while in `0.x` (both, intentionally —
    nothing auto-promotes to a minor/major until `1.0.0` is cut by hand).
  - `BREAKING CHANGE:` footers do not force `1.0.0` while in `0.x`.
- **Deploy:** Vercel is **not** Git-connected, so a tag does **not** trigger a
  deploy. Production is shipped with `vercel --prod`; the git tag + GitHub
  release are a **marker** of exactly what was deployed (for rollback/history).

## Release flow

### One command: `pnpm ship`

```bash
git checkout main && git pull   # start from an up-to-date main
pnpm ship                       # guard → release → push → GitHub release → vercel --prod
```

`pnpm ship` runs the whole flow, fail-fast, with the irreversible deploy last:

1. **Guard** — refuses unless on `main`, clean tree, and in sync with origin.
2. **Confirm** — prompts before doing anything (ends in a prod deploy). Skip
   with `--yes`.
3. **Release** — `pnpm release` (bump + `CHANGELOG.md` + commit + tag).
4. **Push** — `git push --follow-tags origin main`.
5. **GitHub release** — `gh release create vX.Y.Z --generate-notes`.
6. **Deploy** — `vercel --prod`.

If any step fails, the rest do not run; finish manually from the failed step
(see the explicit steps below).

Flags: `pnpm ship:dry` (preview only — no commit/push/deploy),
`pnpm ship --yes` (no prompt), `pnpm ship --release-as minor` (force a bump).

> **Owner-only.** Step 4 pushes the release commit directly to `main`, which
> relies on the repo ruleset's **admin bypass** of the required-PR rule. Run it
> as the repository admin.

### Manual steps (fallback / if `ship` fails midway)

Run from `main`, after your feature PR is merged:

```bash
# 1. Make sure main is up to date
git checkout main && git pull

# 2. (optional) Preview the next version + changelog without writing anything
pnpm release:dry

# 3. Cut the release: bumps package.json, updates CHANGELOG.md, commits, tags
pnpm release

# 4. Push the release commit + tag
git push --follow-tags origin main

# 5. Publish GitHub release notes from the tag (auto-generated from PRs)
gh release create "v$(node -p "require('./package.json').version")" --generate-notes

# 6. Deploy to production
vercel --prod
```

Multiple releases a day are fine — each run bumps the patch again (no date
collisions).

## Forcing a bump

The bump is inferred from commits, but you can override:

```bash
pnpm release:minor                 # force a minor bump
pnpm release -- --release-as patch # force a patch
```

## Cutting the first stable release (1.0.0)

When the app is deemed stable, leave `0.x` deliberately:

```bash
pnpm release -- --release-as 1.0.0
```

After that, normal semver resumes (`feat:` → minor, `fix:` → patch).

## Rolling back

Tags map a version to an exact commit. To inspect or redeploy a previous good
release:

```bash
git checkout v0.1.0        # inspect that release's code
vercel --prod              # redeploy from it (then return to main)
```

> Note: branch protection on `main` must allow the release commit + tag to be
> pushed (it is a mechanical version/changelog bump). Push with your admin
> rights, or relax the rule for this commit if it is blocked.
