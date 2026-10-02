import { relations, sql } from "drizzle-orm";
import { check, index, pgTableCreator, primaryKey } from "drizzle-orm/pg-core";
import { type AdapterAccount } from "@auth/core/adapters";
// Source of truth for the quotation document shape lives with the editor.
// `types.ts` is pure types + consts (no "use client", no runtime imports),
// so it is safe to import from this server-only module.
import { type QuotationDocument } from "@/app/editor/_components/types";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `mm_web_${name}`);

/**
 * Catalog products rendered on the home page as cards.
 * For the POC these are mocked rows seeded into the database.
 */
export const products = createTable(
  "product",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    name: d.varchar({ length: 256 }).notNull(),
    /** Product reference / catalog code (e.g. "tx-10"). Always present. */
    reference: d.varchar({ length: 64 }).notNull().unique(),
    description: d.text(),
    /** Unit price in COP (the only currency). Stored as exact decimal. */
    price: d.numeric({ precision: 14, scale: 2 }).notNull(),
    /** Image URL (eventually a CDN / object-storage link). */
    imageUrl: d.text("image_url"),
    createdAt: d
      .timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: d
      .timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => /* @__PURE__ */ new Date()),
  }),
  (t) => [index("products_name_idx").on(t.name)],
);

/**
 * Color variant of a product: swatch color, current stock and
 * packaging info shown on the product card.
 */
export const productVariants = createTable(
  "product_variant",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    productId: d
      .uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    colorName: d.varchar("color_name", { length: 128 }).notNull(),
    colorHex: d.varchar("color_hex", { length: 9 }).notNull(),
    stock: d.integer().notNull().default(0),
    /** Packaging info, e.g. "Box of 24" or "Bulk pallet" */
    packaging: d.varchar({ length: 256 }),
  }),
  (t) => [
    index("product_variants_product_id_idx").on(t.productId),
    // Enforce #RGB / #RRGGBB / #RRGGBBAA hex colors at the DB level.
    check(
      "product_variant_color_hex_check",
      sql`${t.colorHex} ~ '^#[0-9A-Fa-f]{6,8}$'`,
    ),
  ],
);

export const productsRelations = relations(products, ({ many }) => ({
  variants: many(productVariants),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
}));

/**
 * A saved quotation. The full quotation document (pages, elements, client
 * details, etc.) is stored as JSONB in `data`; the scalar columns hold the
 * fields used for listing/searching. `references` is an array of related
 * document ids (e.g. linked orders or source quotations).
 */
export const quotations = createTable(
  "quotation",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    /** Auto-incrementing sequential quotation number (1, 2, 3, ...). */
    quotationNumber: d.serial("quotation_number").notNull().unique(),
    clientName: d.varchar("client_name", { length: 256 }).notNull(),
    /**
     * External CRM client identifier. No local FK by design — the CRM is the
     * system of record; `clientName` is a point-in-time snapshot on the quote.
     */
    clientId: d.varchar("client_id", { length: 255 }),
    /** Owner of the quotation (the user who created it). */
    userId: d
      .uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * Snapshot of the product reference codes included in this quotation,
     * e.g. ["tx-10", "ser 001", "j8"]. Captured at quote time.
     */
    references: d.text().array(),
    /** Full quotation document: { meta, pages }. See QuotationDocument. */
    data: d.jsonb().$type<QuotationDocument>().notNull(),
    createdDate: d
      .timestamp("created_date", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedDate: d
      .timestamp("updated_date", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => /* @__PURE__ */ new Date()),
  }),
  (t) => [index("quotations_user_id_idx").on(t.userId)],
);

export const quotationsRelations = relations(quotations, ({ one }) => ({
  user: one(users, { fields: [quotations.userId], references: [users.id] }),
}));

export const users = createTable("user", (d) => ({
  id: d.uuid().primaryKey().defaultRandom(),
  name: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }).notNull().unique(),
  emailVerified: d
    .timestamp({
      mode: "date",
      withTimezone: true,
    })
    .$defaultFn(() => /* @__PURE__ */ new Date()),
  image: d.varchar({ length: 255 }),
  /** Argon2 hash of the user's password (credentials login) */
  passwordHash: d.varchar({ length: 255 }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
}));

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .uuid()
      .notNull()
      .references(() => users.id),
    type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.varchar({ length: 255 }),
    scope: d.varchar({ length: 255 }),
    id_token: d.text(),
    session_state: d.varchar({ length: 255 }),
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  (d) => ({
    sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
    userId: d
      .uuid()
      .notNull()
      .references(() => users.id),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);
