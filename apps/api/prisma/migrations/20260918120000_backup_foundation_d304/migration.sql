-- D304 Backup & Recovery foundation (manifest-only LOCAL_FS)
CREATE TYPE "BckDestinationType" AS ENUM ('LOCAL_FS');
CREATE TYPE "BckDestinationHealth" AS ENUM ('UNKNOWN', 'HEALTHY', 'DEGRADED', 'UNAVAILABLE');
CREATE TYPE "BckBackupType" AS ENUM ('FULL');
CREATE TYPE "BckBackupScope" AS ENUM ('CONFIGURATION', 'DATABASE');
CREATE TYPE "BckBackupStatus" AS ENUM (
  'REQUESTED', 'QUEUED', 'RUNNING', 'VERIFYING', 'VERIFIED', 'FAILED', 'CORRUPTED', 'LOCKED'
);
CREATE TYPE "BckJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

CREATE TABLE "bck_destination" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "type" "BckDestinationType" NOT NULL DEFAULT 'LOCAL_FS',
  "name" TEXT NOT NULL,
  "path_ref" TEXT NOT NULL,
  "health_status" "BckDestinationHealth" NOT NULL DEFAULT 'UNKNOWN',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "bck_destination_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bck_destination_company_id_enabled_idx" ON "bck_destination"("company_id", "enabled");

CREATE TABLE "bck_policy" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "scope" "BckBackupScope" NOT NULL DEFAULT 'CONFIGURATION',
  "type" "BckBackupType" NOT NULL DEFAULT 'FULL',
  "schedule_enabled" BOOLEAN NOT NULL DEFAULT false,
  "schedule_cron" TEXT,
  "verification_required" BOOLEAN NOT NULL DEFAULT true,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "bck_policy_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bck_policy_company_id_enabled_idx" ON "bck_policy"("company_id", "enabled");

CREATE TABLE "bck_backup" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "site_id" UUID,
  "type" "BckBackupType" NOT NULL DEFAULT 'FULL',
  "scope" "BckBackupScope" NOT NULL DEFAULT 'CONFIGURATION',
  "status" "BckBackupStatus" NOT NULL DEFAULT 'REQUESTED',
  "restorable" BOOLEAN NOT NULL DEFAULT false,
  "locked" BOOLEAN NOT NULL DEFAULT false,
  "label" TEXT,
  "size_bytes" BIGINT,
  "checksum_sha256" TEXT,
  "artifact_path" TEXT,
  "destination_id" UUID,
  "created_by_user_id" UUID,
  "error_code" TEXT,
  "error_message" TEXT,
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "bck_backup_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bck_backup_company_id_status_created_at_idx"
  ON "bck_backup"("company_id", "status", "created_at" DESC);
CREATE INDEX "bck_backup_company_id_destination_id_idx"
  ON "bck_backup"("company_id", "destination_id");

CREATE TABLE "bck_manifest" (
  "id" UUID NOT NULL,
  "backup_id" UUID NOT NULL,
  "application_version" TEXT NOT NULL,
  "schema_version" TEXT NOT NULL,
  "module_versions_json" JSONB NOT NULL DEFAULT '{}',
  "scope_metadata_json" JSONB NOT NULL DEFAULT '{}',
  "checksum_algorithm" TEXT NOT NULL DEFAULT 'sha256',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bck_manifest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bck_manifest_backup_id_key" ON "bck_manifest"("backup_id");

CREATE TABLE "bck_job" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "backup_id" UUID NOT NULL,
  "thunder_job_id" TEXT,
  "status" "BckJobStatus" NOT NULL DEFAULT 'PENDING',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "error_code" TEXT,
  "error_message" TEXT,
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "bck_job_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bck_job_company_id_status_created_at_idx"
  ON "bck_job"("company_id", "status", "created_at" DESC);
CREATE INDEX "bck_job_backup_id_idx" ON "bck_job"("backup_id");

ALTER TABLE "bck_backup"
  ADD CONSTRAINT "bck_backup_destination_id_fkey"
  FOREIGN KEY ("destination_id") REFERENCES "bck_destination"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bck_manifest"
  ADD CONSTRAINT "bck_manifest_backup_id_fkey"
  FOREIGN KEY ("backup_id") REFERENCES "bck_backup"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bck_job"
  ADD CONSTRAINT "bck_job_backup_id_fkey"
  FOREIGN KEY ("backup_id") REFERENCES "bck_backup"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
