/**
 * Bulk creates or updates credential users from a CSV file.
 *
 * Usage:
 *   pnpm db:seed:users <csv-file>
 *
 * Required column: email. Optional: password, name, alias, phone, phone_ext,
 * cellphone. Supplied passwords are hashed with argon2id before being stored.
 */
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { hash } from "argon2";
import postgres from "postgres";

const [filePath] = process.argv.slice(2);

if (!filePath) {
  console.error("Usage: pnpm db:seed:users <csv-file>");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Is your .env file in place?");
  process.exit(1);
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function readUsers(source) {
  const rows = parseCsv(source.replace(/^\uFEFF/, ""));
  const header = rows.shift()?.map((value) => value.trim().toLowerCase());
  if (!header?.length) throw new Error("CSV is empty or missing a header row.");

  for (const required of ["email"]) {
    if (!header.includes(required)) {
      throw new Error(`CSV is missing the required '${required}' column.`);
    }
  }

  const seenEmails = new Set();
  const users = [];

  for (const [index, values] of rows.entries()) {
    if (values.every((value) => value.trim() === "")) continue;
    const valueAt = (column) => {
      const columnIndex = header.indexOf(column);
      return columnIndex < 0 ? "" : (values[columnIndex] ?? "").trim();
    };
    const email = valueAt("email");
    const password = valueAt("password");
    const rowNumber = index + 2;

    if (!email) {
      throw new Error(`CSV row ${rowNumber} needs an email.`);
    }
    if (!email.includes("@")) {
      throw new Error(`CSV row ${rowNumber} has an invalid email address.`);
    }
    const normalizedEmail = email.toLowerCase();
    if (seenEmails.has(normalizedEmail)) {
      throw new Error(`CSV contains duplicate email '${email}' (row ${rowNumber}).`);
    }
    seenEmails.add(normalizedEmail);

    const phoneExt = valueAt("phone_ext");
    if (phoneExt && (!/^\d+$/.test(phoneExt) || Number(phoneExt) > 2147483647)) {
      throw new Error(`CSV row ${rowNumber} has an invalid phone_ext.`);
    }

    users.push({
      email,
      password,
      name: valueAt("name") || null,
      alias: valueAt("alias") || null,
      phone: valueAt("phone") || null,
      phoneExt: phoneExt ? Number(phoneExt) : null,
      cellphone: valueAt("cellphone") || null,
      rowNumber,
    });
  }

  if (users.length === 0) throw new Error("CSV contains no user rows.");
  return users;
}

let users;
try {
  users = readUsers(await readFile(filePath, "utf8"));
} catch (error) {
  console.error(`Could not read users CSV: ${error.message}`);
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  for (const user of users) {
    user.passwordHash = user.password
      ? await hash(user.password, { type: 2 })
      : null;
  }

  await sql.begin(async (transaction) => {
    for (const user of users) {
      await transaction`
        INSERT INTO mm_web_user (
          id, name, alias, email, email_verified, password_hash, phone, phone_ext, cellphone
        )
        VALUES (
          ${randomUUID()}, ${user.name}, ${user.alias}, ${user.email}, now(),
          ${user.passwordHash}, ${user.phone}, ${user.phoneExt}, ${user.cellphone}
        )
        ON CONFLICT (email) DO UPDATE SET
          name = COALESCE(EXCLUDED.name, mm_web_user.name),
          alias = COALESCE(EXCLUDED.alias, mm_web_user.alias),
          password_hash = COALESCE(EXCLUDED.password_hash, mm_web_user.password_hash),
          phone = COALESCE(EXCLUDED.phone, mm_web_user.phone),
          phone_ext = COALESCE(EXCLUDED.phone_ext, mm_web_user.phone_ext),
          cellphone = COALESCE(EXCLUDED.cellphone, mm_web_user.cellphone)
      `;
    }
  });

  console.log(`Seeded ${users.length} users.`);
} catch (error) {
  console.error("User import failed; no users were changed:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
