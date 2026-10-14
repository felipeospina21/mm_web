ALTER TABLE "mm_web_account" RENAME COLUMN "userId" TO "user_id";--> statement-breakpoint
ALTER TABLE "mm_web_account" RENAME COLUMN "providerAccountId" TO "provider_account_id";--> statement-breakpoint
ALTER TABLE "mm_web_session" RENAME COLUMN "sessionToken" TO "session_token";--> statement-breakpoint
ALTER TABLE "mm_web_session" RENAME COLUMN "userId" TO "user_id";--> statement-breakpoint
ALTER TABLE "mm_web_user" RENAME COLUMN "emailVerified" TO "email_verified";--> statement-breakpoint
ALTER TABLE "mm_web_user" RENAME COLUMN "passwordHash" TO "password_hash";--> statement-breakpoint
ALTER TABLE "mm_web_quotation" DROP CONSTRAINT "mm_web_quotation_quotation_number_unique";--> statement-breakpoint
ALTER TABLE "mm_web_account" DROP CONSTRAINT "mm_web_account_userId_mm_web_user_id_fk";
--> statement-breakpoint
ALTER TABLE "mm_web_session" DROP CONSTRAINT "mm_web_session_userId_mm_web_user_id_fk";
--> statement-breakpoint
DROP INDEX "account_user_id_idx";--> statement-breakpoint
DROP INDEX "session_user_id_idx";--> statement-breakpoint
ALTER TABLE "mm_web_account" DROP CONSTRAINT "mm_web_account_provider_providerAccountId_pk";--> statement-breakpoint
ALTER TABLE "mm_web_account" ADD CONSTRAINT "mm_web_account_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id");--> statement-breakpoint
ALTER TABLE "mm_web_user" ADD COLUMN "phone_ext" integer;--> statement-breakpoint
ALTER TABLE "mm_web_account" ADD CONSTRAINT "mm_web_account_user_id_mm_web_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mm_web_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mm_web_session" ADD CONSTRAINT "mm_web_session_user_id_mm_web_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mm_web_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "mm_web_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "mm_web_session" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "mm_web_quotation" ADD CONSTRAINT "mm_web_quotation_quotationNumber_unique" UNIQUE("quotation_number");