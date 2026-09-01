-- CreateEnum
CREATE TYPE "IamUserStatus" AS ENUM ('INVITED', 'ACTIVE', 'LOCKED', 'DISABLED');

-- CreateEnum
CREATE TYPE "IamLifecycleStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "OrgCompanyStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OrgSiteType" AS ENUM ('USINE', 'DEPOT', 'BUREAU');

-- CreateEnum
CREATE TYPE "OrgWarehouseType" AS ENUM ('FROID', 'SEC', 'QUAI');

-- CreateEnum
CREATE TYPE "ModModuleStatus" AS ENUM ('ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ThunderJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ThunderWorkflowStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "core_outbox" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_version" INTEGER NOT NULL DEFAULT 1,
    "payload_json" JSONB NOT NULL,
    "headers" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),
    "publish_attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "core_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_processed_event" (
    "id" UUID NOT NULL,
    "consumer" TEXT NOT NULL,
    "event_id" UUID NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "core_processed_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_numbering_series" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "site_id" UUID,
    "doc_type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "prefix" TEXT NOT NULL,
    "next_value" INTEGER NOT NULL DEFAULT 1,
    "padding" INTEGER NOT NULL DEFAULT 6,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "core_numbering_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_file" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "checksum" TEXT,
    "virus_scan" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "core_file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_search_index" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "core_search_index_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iam_user" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" "IamUserStatus" NOT NULL DEFAULT 'INVITED',
    "locale" TEXT NOT NULL DEFAULT 'fr-TN',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Tunis',
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "iam_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iam_session" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "env" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "refresh_hash" TEXT,
    "status" "IamLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "iam_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iam_mfa_device" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "secret_enc" TEXT NOT NULL,
    "last_used_at" TIMESTAMPTZ(6),
    "status" "IamLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "iam_mfa_device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iam_device" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT,
    "fingerprint" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "iam_device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iam_login_attempt" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "email" TEXT,
    "ip" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iam_login_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_company" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'TN',
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Tunis',
    "vat_number" TEXT,
    "status" "OrgCompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "org_company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_site" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" "OrgSiteType" NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Tunis',
    "status" "OrgCompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "org_site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_warehouse" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" "OrgWarehouseType" NOT NULL,
    "temp_min_max" TEXT,
    "status" "OrgCompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "org_warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_department" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "org_department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_team" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "department_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "org_team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_user_assignment" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "site_id" UUID,
    "role_code" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "org_user_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_module_state" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "module_key" TEXT NOT NULL,
    "status" "ModModuleStatus" NOT NULL DEFAULT 'DISABLED',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mod_module_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_flag" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "flag_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mod_flag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aud_event" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "site_id" UUID,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" UUID,
    "before_json" JSONB,
    "after_json" JSONB,
    "ip" TEXT,
    "device" TEXT,
    "correlation_id" TEXT,
    "mode" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aud_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thunder_job" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "job_type" TEXT NOT NULL,
    "payload_ref" TEXT,
    "status" "ThunderJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "thunder_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thunder_workflow_instance" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "definition_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ThunderWorkflowStatus" NOT NULL DEFAULT 'PENDING',
    "cursor_step" TEXT,
    "data_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "thunder_workflow_instance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "core_outbox_company_id_created_at_idx" ON "core_outbox"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "core_outbox_published_at_idx" ON "core_outbox"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "core_processed_event_consumer_event_id_key" ON "core_processed_event"("consumer", "event_id");

-- CreateIndex
CREATE INDEX "core_numbering_series_company_id_created_at_idx" ON "core_numbering_series"("company_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "core_numbering_series_company_id_site_id_doc_type_year_key" ON "core_numbering_series"("company_id", "site_id", "doc_type", "year");

-- CreateIndex
CREATE INDEX "core_file_company_id_created_at_idx" ON "core_file"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "core_search_index_company_id_entity_type_idx" ON "core_search_index"("company_id", "entity_type");

-- CreateIndex
CREATE UNIQUE INDEX "iam_user_email_key" ON "iam_user"("email");

-- CreateIndex
CREATE INDEX "iam_session_user_id_created_at_idx" ON "iam_session"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "iam_mfa_device_user_id_idx" ON "iam_mfa_device"("user_id");

-- CreateIndex
CREATE INDEX "iam_device_user_id_idx" ON "iam_device"("user_id");

-- CreateIndex
CREATE INDEX "iam_login_attempt_email_created_at_idx" ON "iam_login_attempt"("email", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "org_company_code_key" ON "org_company"("code");

-- CreateIndex
CREATE INDEX "org_site_company_id_created_at_idx" ON "org_site"("company_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "org_site_company_id_code_key" ON "org_site"("company_id", "code");

-- CreateIndex
CREATE INDEX "org_warehouse_company_id_site_id_idx" ON "org_warehouse"("company_id", "site_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_warehouse_company_id_code_key" ON "org_warehouse"("company_id", "code");

-- CreateIndex
CREATE INDEX "org_department_company_id_created_at_idx" ON "org_department"("company_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "org_department_company_id_code_key" ON "org_department"("company_id", "code");

-- CreateIndex
CREATE INDEX "org_team_company_id_created_at_idx" ON "org_team"("company_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "org_team_company_id_code_key" ON "org_team"("company_id", "code");

-- CreateIndex
CREATE INDEX "org_user_assignment_company_id_created_at_idx" ON "org_user_assignment"("company_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "org_user_assignment_company_id_user_id_key" ON "org_user_assignment"("company_id", "user_id");

-- CreateIndex
CREATE INDEX "mod_module_state_company_id_idx" ON "mod_module_state"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "mod_module_state_company_id_module_key_key" ON "mod_module_state"("company_id", "module_key");

-- CreateIndex
CREATE INDEX "mod_flag_company_id_idx" ON "mod_flag"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "mod_flag_company_id_flag_key_key" ON "mod_flag"("company_id", "flag_key");

-- CreateIndex
CREATE INDEX "aud_event_company_id_occurred_at_idx" ON "aud_event"("company_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "thunder_job_company_id_status_created_at_idx" ON "thunder_job"("company_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "thunder_workflow_instance_company_id_status_created_at_idx" ON "thunder_workflow_instance"("company_id", "status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "iam_session" ADD CONSTRAINT "iam_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iam_mfa_device" ADD CONSTRAINT "iam_mfa_device_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iam_device" ADD CONSTRAINT "iam_device_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iam_login_attempt" ADD CONSTRAINT "iam_login_attempt_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_site" ADD CONSTRAINT "org_site_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "org_company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_warehouse" ADD CONSTRAINT "org_warehouse_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "org_site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_user_assignment" ADD CONSTRAINT "org_user_assignment_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "org_company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_user_assignment" ADD CONSTRAINT "org_user_assignment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
