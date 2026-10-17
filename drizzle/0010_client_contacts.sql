CREATE TABLE "mm_web_client_contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(256) NOT NULL,
	"phone" varchar(32),
	"email" varchar(255),
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mm_web_client_contact" ADD CONSTRAINT "mm_web_client_contact_client_id_mm_web_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."mm_web_client"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "client_contacts_client_id_idx" ON "mm_web_client_contact" USING btree ("client_id");
--> statement-breakpoint
ALTER TABLE "mm_web_user" ADD COLUMN "alias" varchar(32);
--> statement-breakpoint
INSERT INTO "mm_web_client_contact" ("client_id", "name", "phone", "email")
SELECT "id", COALESCE(NULLIF(BTRIM("contact_name"), ''), 'Unnamed contact'), "contact_phone", "contact_email"
FROM "mm_web_client"
WHERE NULLIF(BTRIM("contact_name"), '') IS NOT NULL
	OR "contact_phone" IS NOT NULL
	OR "contact_email" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "mm_web_client" DROP COLUMN "contact_name";
--> statement-breakpoint
ALTER TABLE "mm_web_client" DROP COLUMN "contact_phone";
--> statement-breakpoint
ALTER TABLE "mm_web_client" DROP COLUMN "contact_email";
