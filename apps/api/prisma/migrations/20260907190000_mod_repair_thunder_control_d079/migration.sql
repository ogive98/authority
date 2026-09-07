-- Repair / Thunder Control D079
CREATE TYPE "RepScanStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL');
CREATE TYPE "RepFindingSeverity" AS ENUM ('INFO', 'WARN', 'ERROR', 'CRITICAL');
CREATE TYPE "RepFindingState" AS ENUM ('OPEN', 'ACKED', 'RESOLVED', 'IGNORED');
CREATE TYPE "RepRiskLevel" AS ENUM ('NONE', 'SAFE', 'LOW', 'MEDIUM', 'HIGH', 'BLOCKED');
CREATE TYPE "RepExecutionStatus" AS ENUM ('PLANNED', 'DRY_RUN', 'APPROVED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'ROLLED_BACK', 'BLOCKED');
CREATE TYPE "RepReportStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'ACKED', 'FAILED');

CREATE TABLE "rep_scan_execution" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "depth" TEXT NOT NULL,
    "domains_json" JSONB NOT NULL,
    "status" "RepScanStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "finding_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "summary_json" JSONB,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "rep_scan_execution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rep_diagnostic_finding" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "scan_id" UUID NOT NULL,
    "component" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" "RepFindingSeverity" NOT NULL DEFAULT 'WARN',
    "confidence" TEXT NOT NULL DEFAULT 'PROBABLE',
    "signature_id" TEXT,
    "evidence_summary" TEXT NOT NULL,
    "evidence_fingerprint" TEXT NOT NULL,
    "occurrence_count" INTEGER NOT NULL DEFAULT 1,
    "state" "RepFindingState" NOT NULL DEFAULT 'OPEN',
    "repairability" TEXT DEFAULT 'unknown',
    "recommended_json" JSONB,
    "risk" "RepRiskLevel" NOT NULL DEFAULT 'NONE',
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "rep_diagnostic_finding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rep_diagnostic_incident" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "fingerprint" TEXT NOT NULL,
    "status" "RepFindingState" NOT NULL DEFAULT 'OPEN',
    "severity" "RepFindingSeverity" NOT NULL DEFAULT 'WARN',
    "signature_id" TEXT,
    "title" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "central_incident_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "rep_diagnostic_incident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rep_repair_execution" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "finding_id" UUID,
    "scenario_id" TEXT NOT NULL,
    "risk" "RepRiskLevel" NOT NULL,
    "status" "RepExecutionStatus" NOT NULL DEFAULT 'PLANNED',
    "dry_run" BOOLEAN NOT NULL DEFAULT true,
    "plan_json" JSONB NOT NULL,
    "result_json" JSONB,
    "snapshot_ref" TEXT,
    "verification_json" JSONB,
    "rollback_json" JSONB,
    "approved_by" UUID,
    "executed_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "rep_repair_execution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rep_reset_execution" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "scope" TEXT NOT NULL,
    "preview_json" JSONB NOT NULL,
    "status" "RepExecutionStatus" NOT NULL DEFAULT 'PLANNED',
    "dry_run" BOOLEAN NOT NULL DEFAULT true,
    "result_json" JSONB,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "rep_reset_execution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rep_central_report" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "report_type" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "payload_json" JSONB NOT NULL,
    "status" "RepReportStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "central_id" TEXT,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "rep_central_report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rep_diagnostic_outbox" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "state" "RepReportStatus" NOT NULL DEFAULT 'QUEUED',
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "rep_diagnostic_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rep_scan_execution_company_id_created_at_idx" ON "rep_scan_execution"("company_id", "created_at" DESC);
CREATE INDEX "rep_scan_execution_status_created_at_idx" ON "rep_scan_execution"("status", "created_at" DESC);
CREATE INDEX "rep_diagnostic_finding_scan_id_idx" ON "rep_diagnostic_finding"("scan_id");
CREATE INDEX "rep_diagnostic_finding_company_id_state_idx" ON "rep_diagnostic_finding"("company_id", "state");
CREATE INDEX "rep_diagnostic_finding_evidence_fingerprint_idx" ON "rep_diagnostic_finding"("evidence_fingerprint");
CREATE INDEX "rep_diagnostic_incident_status_last_seen_at_idx" ON "rep_diagnostic_incident"("status", "last_seen_at" DESC);
CREATE INDEX "rep_diagnostic_incident_fingerprint_idx" ON "rep_diagnostic_incident"("fingerprint");
CREATE INDEX "rep_repair_execution_company_id_created_at_idx" ON "rep_repair_execution"("company_id", "created_at" DESC);
CREATE INDEX "rep_repair_execution_status_created_at_idx" ON "rep_repair_execution"("status", "created_at" DESC);
CREATE INDEX "rep_reset_execution_company_id_created_at_idx" ON "rep_reset_execution"("company_id", "created_at" DESC);
CREATE INDEX "rep_central_report_status_created_at_idx" ON "rep_central_report"("status", "created_at");
CREATE INDEX "rep_central_report_fingerprint_idx" ON "rep_central_report"("fingerprint");
CREATE UNIQUE INDEX "rep_diagnostic_outbox_report_id_key" ON "rep_diagnostic_outbox"("report_id");
CREATE INDEX "rep_diagnostic_outbox_state_next_attempt_at_idx" ON "rep_diagnostic_outbox"("state", "next_attempt_at");

ALTER TABLE "rep_diagnostic_finding" ADD CONSTRAINT "rep_diagnostic_finding_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "rep_scan_execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rep_repair_execution" ADD CONSTRAINT "rep_repair_execution_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "rep_diagnostic_finding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rep_diagnostic_outbox" ADD CONSTRAINT "rep_diagnostic_outbox_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "rep_central_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
