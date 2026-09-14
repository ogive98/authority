-- Soft Glass in-app notifications inbox (D247)
CREATE TABLE IF NOT EXISTS "core_in_app_notification" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID,
    "source" TEXT NOT NULL,
    "source_ref_id" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'p2',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "core_in_app_notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "core_in_app_notification_company_id_dedupe_key_key"
  ON "core_in_app_notification"("company_id", "dedupe_key");

CREATE INDEX IF NOT EXISTS "core_in_app_notification_company_id_read_at_created_at_idx"
  ON "core_in_app_notification"("company_id", "read_at", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "core_in_app_notification_company_id_user_id_created_at_idx"
  ON "core_in_app_notification"("company_id", "user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "core_in_app_notification_company_id_source_idx"
  ON "core_in_app_notification"("company_id", "source");
