CREATE TABLE IF NOT EXISTS "mm_web_product_variant" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"productId" varchar(255) NOT NULL,
	"colorName" varchar(128) NOT NULL,
	"colorHex" varchar(9) NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"packaging" varchar(256)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mm_web_product" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"price" varchar(64) NOT NULL,
	"imageUrl" text,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
DROP TABLE IF EXISTS "mm_web_post" CASCADE;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "mm_web_product_variant" ADD CONSTRAINT "mm_web_product_variant_productId_mm_web_product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."mm_web_product"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_variants_product_id_idx" ON "mm_web_product_variant" USING btree ("productId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_name_idx" ON "mm_web_product" USING btree ("name");
