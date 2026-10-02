-- Drop FKs that reference mm_web_user.id so the column type can change
ALTER TABLE "mm_web_account" DROP CONSTRAINT IF EXISTS "mm_web_account_userId_mm_web_user_id_fk";--> statement-breakpoint
ALTER TABLE "mm_web_session" DROP CONSTRAINT IF EXISTS "mm_web_session_userId_mm_web_user_id_fk";--> statement-breakpoint
--> Convert id / userId columns from varchar to uuid (existing values are valid UUIDs)
ALTER TABLE "mm_web_user" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "mm_web_account" ALTER COLUMN "userId" SET DATA TYPE uuid USING "userId"::uuid;--> statement-breakpoint
ALTER TABLE "mm_web_session" ALTER COLUMN "userId" SET DATA TYPE uuid USING "userId"::uuid;--> statement-breakpoint
--> Recreate the FKs
ALTER TABLE "mm_web_account" ADD CONSTRAINT "mm_web_account_userId_mm_web_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."mm_web_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mm_web_session" ADD CONSTRAINT "mm_web_session_userId_mm_web_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."mm_web_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
--> New quotation table
CREATE TABLE "mm_web_quotation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"quotationNumber" serial NOT NULL,
	"clientName" varchar(256) NOT NULL,
	"clientId" varchar(255),
	"userId" uuid NOT NULL,
	"references" text[],
	"data" jsonb NOT NULL,
	"createdDate" timestamp with time zone NOT NULL,
	"updatedDate" timestamp with time zone NOT NULL,
	CONSTRAINT "mm_web_quotation_quotationNumber_unique" UNIQUE("quotationNumber")
);
--> statement-breakpoint
ALTER TABLE "mm_web_quotation" ADD CONSTRAINT "mm_web_quotation_userId_mm_web_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."mm_web_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quotations_user_id_idx" ON "mm_web_quotation" USING btree ("userId");