-- =====================================================================
-- 0004 schema improvements (hand-written, data-preserving).
-- The generated version did ADD + DROP for every renamed column, which
-- would destroy existing data. This version RENAMEs columns in place,
-- casts price with cleanup, and backfills product.reference.
-- End-state (names, types, constraints) matches the drizzle snapshot.
-- =====================================================================

-- --- product_variant: rename camelCase -> snake_case (preserves data) ---
ALTER TABLE "mm_web_product_variant" RENAME COLUMN "productId" TO "product_id";--> statement-breakpoint
ALTER TABLE "mm_web_product_variant" RENAME COLUMN "colorName" TO "color_name";--> statement-breakpoint
ALTER TABLE "mm_web_product_variant" RENAME COLUMN "colorHex" TO "color_hex";--> statement-breakpoint
-- Renaming a column does NOT rename its FK constraint; align the name.
ALTER TABLE "mm_web_product_variant" RENAME CONSTRAINT "mm_web_product_variant_productId_mm_web_product_id_fk" TO "mm_web_product_variant_product_id_mm_web_product_id_fk";--> statement-breakpoint

-- --- product: rename imageUrl/createdAt, add updated_at + reference ---
ALTER TABLE "mm_web_product" RENAME COLUMN "imageUrl" TO "image_url";--> statement-breakpoint
ALTER TABLE "mm_web_product" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "mm_web_product" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "mm_web_product" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint

-- price "$12,500.00" -> numeric(14,2): strip everything except digits and dot.
ALTER TABLE "mm_web_product"
	ALTER COLUMN "price" SET DATA TYPE numeric(14, 2)
	USING NULLIF(regexp_replace("price", '[^0-9.]', '', 'g'), '')::numeric(14, 2);--> statement-breakpoint

-- reference: add nullable, backfill a placeholder derived from name (slug +
-- short id so it is unique), then enforce NOT NULL + UNIQUE.
ALTER TABLE "mm_web_product" ADD COLUMN "reference" varchar(64);--> statement-breakpoint
UPDATE "mm_web_product"
	SET "reference" = 'ref-' || left(regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g'), 48)
		|| '-' || left(replace("id"::text, '-', ''), 6)
	WHERE "reference" IS NULL;--> statement-breakpoint
ALTER TABLE "mm_web_product" ALTER COLUMN "reference" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "mm_web_product" ADD CONSTRAINT "mm_web_product_reference_unique" UNIQUE("reference");--> statement-breakpoint

-- Null out seeded data-URL images; image_url now holds real URLs only.
UPDATE "mm_web_product" SET "image_url" = NULL WHERE "image_url" LIKE 'data:%';--> statement-breakpoint

-- --- quotation: rename columns, add DB-side timestamp defaults ---
ALTER TABLE "mm_web_quotation" RENAME COLUMN "quotationNumber" TO "quotation_number";--> statement-breakpoint
ALTER TABLE "mm_web_quotation" RENAME COLUMN "clientName" TO "client_name";--> statement-breakpoint
ALTER TABLE "mm_web_quotation" RENAME COLUMN "clientId" TO "client_id";--> statement-breakpoint
ALTER TABLE "mm_web_quotation" RENAME COLUMN "userId" TO "user_id";--> statement-breakpoint
ALTER TABLE "mm_web_quotation" RENAME COLUMN "createdDate" TO "created_date";--> statement-breakpoint
ALTER TABLE "mm_web_quotation" RENAME COLUMN "updatedDate" TO "updated_date";--> statement-breakpoint
ALTER TABLE "mm_web_quotation" ALTER COLUMN "created_date" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "mm_web_quotation" ALTER COLUMN "updated_date" SET DEFAULT now();--> statement-breakpoint

-- The serial sequence / unique for quotation_number followed the rename;
-- rename the unique constraint to match the snapshot's expected name.
ALTER TABLE "mm_web_quotation" RENAME CONSTRAINT "mm_web_quotation_quotationNumber_unique" TO "mm_web_quotation_quotation_number_unique";--> statement-breakpoint
ALTER TABLE "mm_web_quotation" RENAME CONSTRAINT "mm_web_quotation_userId_mm_web_user_id_fk" TO "mm_web_quotation_user_id_mm_web_user_id_fk";--> statement-breakpoint

-- --- index renames (indexes hold no data; rename to new names) ---
ALTER INDEX "t_user_id_idx" RENAME TO "session_user_id_idx";--> statement-breakpoint

-- --- colorHex CHECK constraint ---
ALTER TABLE "mm_web_product_variant" ADD CONSTRAINT "product_variant_color_hex_check" CHECK ("mm_web_product_variant"."color_hex" ~ '^#[0-9A-Fa-f]{6,8}$');
