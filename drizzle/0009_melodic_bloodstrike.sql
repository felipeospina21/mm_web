CREATE TABLE "mm_web_client" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(256) NOT NULL,
	"company_id" varchar(255),
	"address" text,
	"phone" varchar(32),
	"contact_name" varchar(256),
	"contact_phone" varchar(32),
	"contact_email" varchar(255),
	"user_id" uuid NOT NULL,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mm_web_client" ADD CONSTRAINT "mm_web_client_user_id_mm_web_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mm_web_user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "clients_user_id_idx" ON "mm_web_client" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "mm_web_quotation" RENAME COLUMN "client_id" TO "legacy_client_id";
--> statement-breakpoint
INSERT INTO "mm_web_client" ("name", "company_id", "user_id")
SELECT DISTINCT ON (
	"user_id",
	COALESCE("legacy_client_id", 'name:' || "client_name")
)
	"client_name",
	"legacy_client_id",
	"user_id"
FROM "mm_web_quotation"
ORDER BY
	"user_id",
	COALESCE("legacy_client_id", 'name:' || "client_name"),
	"created_date";
--> statement-breakpoint
ALTER TABLE "mm_web_quotation" ADD COLUMN "client_id" uuid;
--> statement-breakpoint
UPDATE "mm_web_quotation" AS quotation
SET "client_id" = client."id"
FROM "mm_web_client" AS client
WHERE client."user_id" = quotation."user_id"
	AND (
		(quotation."legacy_client_id" IS NOT NULL AND client."company_id" = quotation."legacy_client_id")
		OR (
			quotation."legacy_client_id" IS NULL
			AND client."company_id" IS NULL
			AND client."name" = quotation."client_name"
		)
	);
--> statement-breakpoint
ALTER TABLE "mm_web_quotation" DROP COLUMN "legacy_client_id";
--> statement-breakpoint
ALTER TABLE "mm_web_quotation" DROP COLUMN "client_name";
--> statement-breakpoint
ALTER TABLE "mm_web_quotation" DROP COLUMN "total";
--> statement-breakpoint
UPDATE "mm_web_quotation"
SET "data" = "data" -> 'pages'
WHERE jsonb_typeof("data") = 'object'
	AND jsonb_typeof("data" -> 'pages') = 'array';
--> statement-breakpoint
ALTER TABLE "mm_web_quotation" ADD CONSTRAINT "mm_web_quotation_client_id_mm_web_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."mm_web_client"("id") ON DELETE set null ON UPDATE no action;
