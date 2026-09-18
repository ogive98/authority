-- D305 Backup installable — restore dual-control requests
CREATE TYPE "BckRestoreStatus" AS ENUM (
  'REQUESTED',
  'PENDING_SECOND_APPROVAL',
  'AUTHORIZED',
  'DRY_VALIDATED',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE "bck_restore_request" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "backup_id" UUID NOT NULL,
  "status" "BckRestoreStatus" NOT NULL DEFAULT 'REQUESTED',
  "requested_by_user_id" UUID NOT NULL,
  "approved_by_user_id" UUID,
  "second_approved_by_user_id" UUID,
  "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_at" TIMESTAMPTZ(6),
  "second_approved_at" TIMESTAMPTZ(6),
  "dry_validated_at" TIMESTAMPTZ(6),
  "applied" BOOLEAN NOT NULL DEFAULT false,
  "error_code" TEXT,
  "error_message" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "bck_restore_request_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bck_restore_request_company_id_status_created_at_idx"
  ON "bck_restore_request"("company_id", "status", "created_at" DESC);
CREATE INDEX "bck_restore_request_backup_id_idx"
  ON "bck_restore_request"("backup_id");

ALTER TABLE "bck_restore_request"
  ADD CONSTRAINT "bck_restore_request_backup_id_fkey"
  FOREIGN KEY ("backup_id") REFERENCES "bck_backup"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
