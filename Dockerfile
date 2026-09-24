##########
# Base   #
##########
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# argon2 is a native addon — needs a toolchain + python to compile.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 build-essential \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

##################
# Dependencies   #
##################
# Full install (incl. dev deps) — needed to build and to run drizzle-kit migrate.
FROM base AS deps
ENV PNPM_CONFIG_STRICT_DEP_BUILDS=false
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

##################
# Builder        #
##################
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Env vars are validated at build time; skip since they arrive at runtime.
ENV SKIP_ENV_VALIDATION=1
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

##################
# Migrator       #
##################
# Keeps the full toolchain so `pnpm db:migrate` (drizzle-kit) can run at startup.
FROM base AS migrator
ENV NODE_ENV=production
# pnpm v10+ turns "ignored build scripts" into a hard error via strictDepBuilds.
# db:migrate doesn't need to (re)build anything, so relax it here.
ENV PNPM_CONFIG_STRICT_DEP_BUILDS=false
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc drizzle.config.ts tsconfig.json ./
COPY drizzle ./drizzle
COPY src ./src
COPY scripts ./scripts
CMD ["pnpm", "db:migrate"]

##################
# Runner         #
##################
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as an unprivileged user.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# The standalone output bundles only the files the server actually needs.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
