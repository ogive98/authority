-- CreateEnum
CREATE TYPE "QuaCheckResult" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "QuaCheckTarget" AS ENUM ('RECEIPT', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "QuaNcrSeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "QuaNcrStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "TrcRecallStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "qua_check" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "target" "QuaCheckTarget" NOT NULL,
    "target_id" UUID NOT NULL,
    "lot_id" UUID,
    "result" "QuaCheckResult" NOT NULL DEFAULT 'PENDING',
    "measures" JSONB,
    "notes" TEXT,
    "checked_by" UUID,
    "checked_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "qua_check_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qua_ncr" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "severity" "QuaNcrSeverity" NOT NULL,
    "status" "QuaNcrStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "disposition" TEXT,
    "lot_id" UUID,
    "check_id" UUID,
    "opened_by" UUID,
    "closed_by" UUID,
    "closed_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "qua_ncr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qua_lot_hold" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "held_by" UUID NOT NULL,
    "held_at" TIMESTAMPTZ(6) NOT NULL,
    "released_by" UUID,
    "released_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "qua_lot_hold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hcp_ccp" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "critical_limit" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "site_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "hcp_ccp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hcp_record" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "ccp_id" UUID NOT NULL,
    "value" DECIMAL(18,3) NOT NULL,
    "in_spec" BOOLEAN NOT NULL,
    "recorded_by" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "hcp_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hcp_audit" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "audit_date" DATE NOT NULL,
    "auditor" TEXT NOT NULL,
    "findings" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "hcp_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trc_lot" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "lot_code" TEXT NOT NULL,
    "product_id" UUID NOT NULL,
    "production_date" DATE,
    "expiry_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "trc_lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trc_link" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "parent_lot_id" UUID NOT NULL,
    "child_lot_id" UUID NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trc_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trc_recall" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "lot_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "TrcRecallStatus" NOT NULL DEFAULT 'PLANNED',
    "initiated_by" UUID NOT NULL,
    "initiated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "trc_recall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "qua_check_company_id_created_at_idx" ON "qua_check"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "qua_check_company_id_lot_id_idx" ON "qua_check"("company_id", "lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "qua_check_company_id_number_key" ON "qua_check"("company_id", "number");

-- CreateIndex
CREATE INDEX "qua_ncr_company_id_created_at_idx" ON "qua_ncr"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "qua_ncr_company_id_status_idx" ON "qua_ncr"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "qua_ncr_company_id_number_key" ON "qua_ncr"("company_id", "number");

-- CreateIndex
CREATE INDEX "qua_lot_hold_company_id_created_at_idx" ON "qua_lot_hold"("company_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "qua_lot_hold_company_id_lot_id_key" ON "qua_lot_hold"("company_id", "lot_id");

-- CreateIndex
CREATE INDEX "hcp_ccp_company_id_active_idx" ON "hcp_ccp"("company_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "hcp_ccp_company_id_code_key" ON "hcp_ccp"("company_id", "code");

-- CreateIndex
CREATE INDEX "hcp_record_company_id_ccp_id_recorded_at_idx" ON "hcp_record"("company_id", "ccp_id", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "hcp_audit_company_id_audit_date_idx" ON "hcp_audit"("company_id", "audit_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "hcp_audit_company_id_number_key" ON "hcp_audit"("company_id", "number");

-- CreateIndex
CREATE INDEX "trc_lot_company_id_product_id_idx" ON "trc_lot"("company_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "trc_lot_company_id_lot_code_key" ON "trc_lot"("company_id", "lot_code");

-- CreateIndex
CREATE INDEX "trc_link_company_id_parent_lot_id_idx" ON "trc_link"("company_id", "parent_lot_id");

-- CreateIndex
CREATE INDEX "trc_link_company_id_child_lot_id_idx" ON "trc_link"("company_id", "child_lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "trc_link_company_id_parent_lot_id_child_lot_id_key" ON "trc_link"("company_id", "parent_lot_id", "child_lot_id");

-- CreateIndex
CREATE INDEX "trc_recall_company_id_created_at_idx" ON "trc_recall"("company_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "trc_recall_company_id_number_key" ON "trc_recall"("company_id", "number");

