/**
 * Creates clients and their contacts from a CSV file.
 *
 * Usage:
 *   pnpm db:seed:clients:dev -- <csv-file>
 *   pnpm db:seed:clients:prod -- <csv-file>
 *
 * Required columns: client_key, owner_email, name.
 * Optional columns: company_id, address, phone, contact_name, contact_phone,
 * contact_email. Column order does not matter. Each client_key groups its
 * contact rows; the database generates client IDs.
 */
import { readFile } from "node:fs/promises";
import postgres from "postgres";

const [filePath] = process.argv.slice(2);

if (!filePath) {
  console.error(
    "Usage: pnpm db:seed:clients:<dev|prod> -- <csv-file>",
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Is the selected env file in place?");
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

function parseEmail(value, label, rowNumber) {
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error(`CSV row ${rowNumber} has an invalid ${label}.`);
  }
}

function readClients(source) {
  const rows = parseCsv(source.replace(/^\uFEFF/, ""));
  const rawHeader = rows.shift()?.map((value) => value.trim().toLowerCase());
  if (!rawHeader?.length) throw new Error("CSV is empty or missing a header row.");

  const header = rawHeader.map((value) => value.replace(/^\ufeff/, ""));
  if (new Set(header).size !== header.length) {
    throw new Error("CSV contains duplicate column headers.");
  }

  for (const required of ["client_key", "owner_email", "name"]) {
    if (!header.includes(required)) {
      throw new Error(`CSV is missing the required '${required}' column.`);
    }
  }

  const clientsByKey = new Map();

  for (const [index, values] of rows.entries()) {
    if (values.every((value) => value.trim() === "")) continue;
    const rowNumber = index + 2;
    const valueAt = (column) => {
      const columnIndex = header.indexOf(column);
      return columnIndex < 0 ? "" : (values[columnIndex] ?? "").trim();
    };

    const clientKey = valueAt("client_key");
    const ownerEmail = valueAt("owner_email").toLowerCase();
    const name = valueAt("name");
    const companyId = valueAt("company_id");
    const address = valueAt("address");
    const phone = valueAt("phone");
    const contactName = valueAt("contact_name");
    const contactPhone = valueAt("contact_phone");
    const contactEmail = valueAt("contact_email").toLowerCase();

    if (!clientKey || !ownerEmail || !name) {
      throw new Error(
        `CSV row ${rowNumber} needs client_key, owner_email, and name.`,
      );
    }
    parseEmail(ownerEmail, "owner_email", rowNumber);
    parseEmail(contactEmail, "contact_email", rowNumber);

    if (name.length > 256 || companyId.length > 255 || phone.length > 32) {
      throw new Error(`CSV row ${rowNumber} exceeds a client field limit.`);
    }

    const hasContactData = contactName || contactPhone || contactEmail;
    if (hasContactData && !contactName) {
      throw new Error(
        `CSV row ${rowNumber} has contact details but no contact_name.`,
      );
    }
    if (contactName.length > 256 || contactPhone.length > 32 || contactEmail.length > 255) {
      throw new Error(`CSV row ${rowNumber} exceeds a contact field limit.`);
    }

    const clientDetails = { ownerEmail, name, companyId, address, phone };
    let client = clientsByKey.get(clientKey);
    if (client) {
      if (
        client.ownerEmail !== ownerEmail ||
        client.name !== name ||
        client.companyId !== companyId ||
        client.address !== address ||
        client.phone !== phone
      ) {
        throw new Error(
          `CSV row ${rowNumber} has different client details for client_key '${clientKey}'.`,
        );
      }
    } else {
      client = { ...clientDetails, rowNumber, contacts: [] };
      clientsByKey.set(clientKey, client);
    }

    if (hasContactData) {
      client.contacts.push({
        name: contactName,
        phone: contactPhone || null,
        email: contactEmail || null,
        rowNumber,
      });
    }
  }

  if (clientsByKey.size === 0) throw new Error("CSV contains no client rows.");
  return [...clientsByKey.entries()].map(([clientKey, client]) => ({
    clientKey,
    ...client,
  }));
}

let clients;
try {
  clients = readClients(await readFile(filePath, "utf8"));
} catch (error) {
  console.error(`Could not read clients CSV: ${error.message}`);
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

try {
  let contactCount = 0;

  await sql.begin(async (transaction) => {
    const ownerEmails = [...new Set(clients.map((client) => client.ownerEmail))];
    const userRows = await transaction`
      SELECT id, lower(email) AS email
      FROM mm_web_user
      WHERE lower(email) IN ${transaction(ownerEmails)}
    `;
    const usersByEmail = new Map();
    for (const user of userRows) {
      if (usersByEmail.has(user.email)) {
        throw new Error(`More than one user has email '${user.email}'.`);
      }
      usersByEmail.set(user.email, user.id);
    }
    const missingOwners = ownerEmails.filter((email) => !usersByEmail.has(email));
    if (missingOwners.length > 0) {
      throw new Error(`No existing user found for: ${missingOwners.join(", ")}`);
    }

    for (const client of clients) {
      const [createdClient] = await transaction`
        INSERT INTO mm_web_client (
          name, company_id, address, phone, user_id
        )
        VALUES (
          ${client.name},
          ${client.companyId || null},
          ${client.address || null},
          ${client.phone || null},
          ${usersByEmail.get(client.ownerEmail)}
        )
        RETURNING id
      `;

      if (client.contacts.length > 0) {
        await transaction`
          INSERT INTO mm_web_client_contact ${transaction(
            client.contacts.map((contact) => ({
              client_id: createdClient.id,
              name: contact.name,
              phone: contact.phone,
              email: contact.email,
            })),
          )}
        `;
        contactCount += client.contacts.length;
      }
    }
  });

  console.log(`Seeded ${clients.length} clients and ${contactCount} contacts.`);
} catch (error) {
  console.error(`Client import failed; no clients were changed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
