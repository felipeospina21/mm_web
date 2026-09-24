# mm_web

Quotation editor built on the [T3 Stack](https://create.t3.gg/) — Next.js (App
Router), NextAuth (email/password), Drizzle ORM, and PostgreSQL.

## Run everything with one command (Docker)

Requires Docker with Compose v2 (`docker compose`).

```bash
docker compose up --build
```

This will:

1. Start PostgreSQL (data persisted in the `db-data` volume).
2. Wait for the database to be healthy, then apply Drizzle migrations.
3. Start the Next.js app on http://localhost:3000 once migrations succeed.

The app opens on the **login page** (`/`). After signing in you are redirected to
the **quotation editor** (`/editor`).

### Create a login user

The app has no public sign-up, so seed a user once the stack is running:

```bash
docker compose run --rm migrate pnpm db:seed you@company.com "your-password" "Your Name"
```

### Configuration

Compose reads these optional environment variables (sensible defaults are baked in
for local use — override them in production):

- `POSTGRES_PASSWORD` — Postgres password (default `postgres`)
- `AUTH_SECRET` — NextAuth secret (a dev default is provided)

## Local development (without Docker)

```bash
./start-database.sh   # starts a local Postgres container
pnpm install
pnpm db:migrate
pnpm db:seed you@company.com "your-password" "Your Name"
pnpm dev
```

## Useful scripts

- `pnpm dev` — start the dev server
- `pnpm build` / `pnpm start` — production build and serve
- `pnpm db:migrate` — apply migrations
- `pnpm db:seed <email> <password> [name]` — create/update a login user
- `pnpm typecheck` — TypeScript check
