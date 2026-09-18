-- D298 Configuration Plan persistence (approve → apply)
CREATE TYPE "SetConfigPlanStatus" AS ENUM (
  'DRAFT',
  'APPROVED',
  'REJECTED',
  'APPLIED',
  'CANCELLED'
);

CREATE TABLE "set_config_plan" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "status" "SetConfigPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "risk_max" TEXT NOT NULL,
  "reason" TEXT,
  "patches_json" JSONB NOT NULL,
  "result_json" JSONB NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "approved_by_user_id" UUID,
  "approved_at" TIMESTAMPTZ(6),
  "rejected_by_user_id" UUID,
  "rejected_at" TIMESTAMPTZ(6),
  "reject_reason" TEXT,
  "applied_by_user_id" UUID,
  "applied_at" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "set_config_plan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "set_config_plan_company_id_status_created_at_idx"
  ON "set_config_plan"("company_id", "status", "created_at" DESC);
