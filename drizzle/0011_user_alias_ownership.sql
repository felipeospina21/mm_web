ALTER TABLE "mm_web_user" ADD COLUMN IF NOT EXISTS "alias" varchar(32);
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'mm_web_client'
      AND column_name = 'alias'
  ) THEN
    EXECUTE 'UPDATE "mm_web_user" AS user_row
      SET "alias" = client_alias."alias"
      FROM (
        SELECT DISTINCT ON ("user_id") "user_id", "alias"
        FROM "mm_web_client"
        WHERE "alias" IS NOT NULL
        ORDER BY "user_id", "id"
      ) AS client_alias
      WHERE user_row."id" = client_alias."user_id"
        AND user_row."alias" IS NULL';
    ALTER TABLE "mm_web_client" DROP COLUMN "alias";
  END IF;
END $$;
