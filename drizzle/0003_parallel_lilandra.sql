-- =====================================================================
-- Part A: add DB-side UUID defaults to already-uuid columns (safe no-ops
-- on existing rows; just attaches DEFAULT gen_random_uuid()).
-- =====================================================================
ALTER TABLE "mm_web_quotation" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "mm_web_user" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint

-- =====================================================================
-- Part B: convert product + product_variant ids from varchar slugs to
-- uuid. Existing slug ids (e.g. 'prod-canvas-tote') are NOT valid UUIDs,
-- so we re-key with fresh UUIDs and rewrite the variant->product FK
-- references to match, before dropping the old slug columns.
-- =====================================================================

-- 1. Drop the FK so we can freely re-key both sides.
ALTER TABLE "mm_web_product_variant" DROP CONSTRAINT IF EXISTS "mm_web_product_variant_productId_mm_web_product_id_fk";--> statement-breakpoint

-- 2. Give every product a fresh UUID in a temp column.
ALTER TABLE "mm_web_product" ADD COLUMN "new_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint

-- 3. Remap each variant to its product's new UUID (join on the old slug
--    productId -> product.id), and give each variant its own fresh UUID.
ALTER TABLE "mm_web_product_variant" ADD COLUMN "new_product_id" uuid;--> statement-breakpoint
ALTER TABLE "mm_web_product_variant" ADD COLUMN "new_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
UPDATE "mm_web_product_variant" v
	SET "new_product_id" = p."new_id"
	FROM "mm_web_product" p
	WHERE v."productId" = p."id";--> statement-breakpoint

-- 4. Swap product.id: drop old slug PK column, promote new_id.
ALTER TABLE "mm_web_product" DROP CONSTRAINT "mm_web_product_pkey";--> statement-breakpoint
ALTER TABLE "mm_web_product" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "mm_web_product" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint
ALTER TABLE "mm_web_product" ADD PRIMARY KEY ("id");--> statement-breakpoint

-- 5. Swap product_variant.id and productId similarly.
ALTER TABLE "mm_web_product_variant" DROP CONSTRAINT "mm_web_product_variant_pkey";--> statement-breakpoint
ALTER TABLE "mm_web_product_variant" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "mm_web_product_variant" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint
ALTER TABLE "mm_web_product_variant" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "mm_web_product_variant" DROP COLUMN "productId";--> statement-breakpoint
ALTER TABLE "mm_web_product_variant" RENAME COLUMN "new_product_id" TO "productId";--> statement-breakpoint
ALTER TABLE "mm_web_product_variant" ALTER COLUMN "productId" SET NOT NULL;--> statement-breakpoint

-- 6. Recreate the FK (cascade on delete, matching schema).
ALTER TABLE "mm_web_product_variant" ADD CONSTRAINT "mm_web_product_variant_productId_mm_web_product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."mm_web_product"("id") ON DELETE cascade ON UPDATE no action;
