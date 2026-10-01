# Docker build & resource optimizations — review backlog

Opportunities to speed up `docker compose build` and reduce image size / resource
usage, captured for later review. Ranked by impact.

## Environment status

`docker buildx` is now **installed** (v0.37.2) and Compose builds use BuildKit.
The `DOCKER_BUILDKIT=0` workaround has been removed from the `docker:build` /
`docker:up:build` scripts.

---

## Already applied (for context)

- **pnpm baked into the base image** via `npm install -g pnpm@12.5.1` (replaced the
  corepack lazy shim that re-downloaded pnpm on every build).
- **BuildKit enabled** — buildx installed, `DOCKER_BUILDKIT=0` removed from scripts.
- **#1 pnpm store cache mount — APPLIED & VERIFIED.** `RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store`
  on the `deps` stage.
- **#2 Next.js build cache mount — APPLIED & VERIFIED.** `RUN --mount=type=cache,id=next-cache,target=/app/.next/cache`
  on the `builder` stage. Verified a source-only change rebuilds in ~7s with
  incremental compile from the persisted cache (vs a cold full build).

---

## Remaining backlog

The `deps` stage does a full install (incl. dev deps) because the builder needs
them. The `migrator` stage copies that same full `node_modules`, dragging eslint,
prettier, typescript, tailwind tooling, etc. into an image that only runs
`drizzle-kit migrate`.

`drizzle-kit` is currently a **devDependency**, so a naive `--prod` install would
drop it. Plan:

1. Move `drizzle-kit` (and anything else migrate needs at runtime) from
   `devDependencies` to `dependencies` in `package.json`.
2. Add a prod-only deps stage:
   ```dockerfile
   FROM base AS prod-deps
   ENV PNPM_CONFIG_STRICT_DEP_BUILDS=false
   COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
   RUN pnpm install --prod --frozen-lockfile
   ```
3. Point the `migrator` stage at `--from=prod-deps /app/node_modules`.

**Impact:** medium — meaningfully smaller migrator image, less memory at migrate time.
**Risk:** medium — must verify `drizzle-kit migrate` still runs with a prod-only
tree and that `drizzle.config.ts` (TypeScript) still loads. Test:
`docker compose run --rm migrate pnpm db:migrate` against a scratch DB before
merging.

## 4. Split the base image to drop the build toolchain from the migrator  — works on legacy builder

The `base` stage installs `build-base` + `python3` (gcc/g++/make) so native addons
like `argon2` can compile during `pnpm install`. The migrator inherits this
toolchain but never compiles anything.

Plan: split into `base-build` (with toolchain, used by `deps`/`builder`) and a
slimmer `base-runtime` (no toolchain, used by `migrator`). The migrator still needs
`libc6-compat` for native addons to *load*, but not the compiler.

**Impact:** medium — smaller migrator image.
**Risk:** medium — more stages; verify argon2/postgres load under musl in the
slimmer runtime.

## 5. Tighten `.dockerignore`  — works on legacy builder

Current ignore list is already solid (`node_modules`, `.next`, `.git`, env files,
editor dirs). Minor additions to shrink build context:

- `*.md`, `docs/`
- `.github/`
- test files / fixtures if any are added later

**Impact:** small — faster context transfer.
**Risk:** none.

## 6. Parallelize `migrate` and `app` image builds  — REQUIRES BUILDKIT

With BuildKit, Compose builds independent stages concurrently rather than serially.
No Dockerfile change needed beyond enabling BuildKit (see prerequisite).

**Impact:** small–medium.
**Risk:** none, once buildx exists.

## 7. Pin the base image by digest  — works on legacy builder

Pin `node:22-alpine` and `postgres:16-alpine` by digest for reproducible builds.

```dockerfile
FROM node:22-alpine@sha256:... AS base
```

**Impact:** none on speed; improves reproducibility.
**Risk:** none (must refresh digest on intentional upgrades).

---

## Suggested order for remaining items

Done: buildx install, #1 pnpm store cache, #2 Next.js build cache.

Remaining, in order:

1. #3 migrator dev-deps pruning (needs careful migrate test).
2. #4 base split, #5 dockerignore, #6 parallel build, #7 digest pin as polish.
