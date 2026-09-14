-- D245 Automation ASSISTED profiles (human-gated, no critical FULL_AUTO)

DO $$ BEGIN
  CREATE TYPE "AtmProfileMode" AS ENUM ('ASSISTED', 'REQUIRES_APPROVAL', 'FULL_AUTO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AtmTriggerKind" AS ENUM (
    'FINANCE_OVERDUE_OPEN_ITEMS',
    'PORTAL_PAYMENT_DECLARATION_SUBMITTED',
    'SALES_DRAFT_ORDER_STALE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AtmActionKind" AS ENUM (
    'NOTIFY',
    'PREPARE_DUNNING_HINT',
    'ORDER_REVIEW_HINT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AtmRunStatus" AS ENUM (
    'SUGGESTED',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'SKIPPED',
    'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "atm_profile" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "mode" "AtmProfileMode" NOT NULL DEFAULT 'ASSISTED',
  "trigger_kind" "AtmTriggerKind" NOT NULL,
  "action_kind" "AtmActionKind" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "shadow_mode" BOOLEAN NOT NULL DEFAULT false,
  "config_json" JSONB NOT NULL DEFAULT '{}',
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "atm_profile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "atm_profile_company_id_code_key"
  ON "atm_profile"("company_id", "code");
CREATE INDEX IF NOT EXISTS "atm_profile_company_id_enabled_updated_at_idx"
  ON "atm_profile"("company_id", "enabled", "updated_at" DESC);
CREATE INDEX IF NOT EXISTS "atm_profile_company_id_trigger_kind_idx"
  ON "atm_profile"("company_id", "trigger_kind");

CREATE TABLE IF NOT EXISTS "atm_run_log" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "profile_id" UUID NOT NULL,
  "number" TEXT NOT NULL,
  "status" "AtmRunStatus" NOT NULL DEFAULT 'SUGGESTED',
  "trigger_ref" TEXT,
  "summary" TEXT NOT NULL,
  "payload_json" JSONB NOT NULL DEFAULT '{}',
  "result_json" JSONB NOT NULL DEFAULT '{}',
  "created_by_user_id" UUID,
  "reviewed_by_user_id" UUID,
  "reviewed_at" TIMESTAMPTZ(6),
  "review_note" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "atm_run_log_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "atm_run_log_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "atm_profile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "atm_run_log_company_id_number_key"
  ON "atm_run_log"("company_id", "number");
CREATE INDEX IF NOT EXISTS "atm_run_log_company_id_status_created_at_idx"
  ON "atm_run_log"("company_id", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "atm_run_log_company_id_profile_id_created_at_idx"
  ON "atm_run_log"("company_id", "profile_id", "created_at" DESC);
