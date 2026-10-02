ALTER TABLE "mm_web_quotation" ADD COLUMN "product_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mm_web_quotation" ADD COLUMN "total" numeric(14, 2) DEFAULT '0' NOT NULL;