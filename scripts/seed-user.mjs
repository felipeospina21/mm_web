/**
 * Creates (or updates) a user with an email/password login.
 *
 * Usage:
 *   pnpm db:seed <email> <password> [name]
 *
 * Example:
 *   pnpm db:seed felipe@company.com "S3cure-Passw0rd!" "Felipe"
 *
 * The password is hashed with argon2id before being stored.
 * Requires DATABASE_URL (loaded from .env via --env-file).
 */
import { randomUUID } from "node:crypto";
import { hash } from "argon2";
import postgres from "postgres";

const [email, password, name] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: pnpm db:seed <email> <password> [name]");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Is your .env file in place?");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const passwordHash = await hash(password, { type: 2 /* argon2id */ });

  const [user] = await sql`
    INSERT INTO mm_web_user (id, name, email, "emailVerified", "passwordHash")
    VALUES (${randomUUID()}, ${name ?? null}, ${email}, now(), ${passwordHash})
    ON CONFLICT (email) DO UPDATE
      SET name = EXCLUDED.name,
          "passwordHash" = EXCLUDED."passwordHash"
    RETURNING id, name, email
  `;

  console.log(`User ready: ${user.email} (id: ${user.id})`);
} finally {
  await sql.end();
}
