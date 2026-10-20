-- Store the public quotation identifier as a string and generate it in Postgres.
CREATE SEQUENCE IF NOT EXISTS "mm_web_quotation_number_seq";
--> statement-breakpoint
SELECT setval(
  'mm_web_quotation_number_seq',
  GREATEST(
    10000,
    COALESCE((SELECT MAX("quotation_number") + 10000 FROM "mm_web_quotation"), 10000)
  ),
  false
);
--> statement-breakpoint
ALTER TABLE "mm_web_quotation"
  ALTER COLUMN "quotation_number" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "mm_web_quotation"
  ALTER COLUMN "quotation_number" TYPE varchar(32)
  USING ('M' || ("quotation_number" + 9999)::text);
--> statement-breakpoint
ALTER TABLE "mm_web_quotation"
  ALTER COLUMN "quotation_number"
  SET DEFAULT ('M' || nextval('mm_web_quotation_number_seq'::regclass)::text);
--> statement-breakpoint
ALTER SEQUENCE "mm_web_quotation_number_seq"
  OWNED BY "mm_web_quotation"."quotation_number";
