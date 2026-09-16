-- D282 RAS withholding object + TEJ Center foundation
CREATE TYPE "TaxWithholdingStatus" AS ENUM (
  'DETECTED',
  'CALCULATED',
  'VALIDATED',
  'CERTIFICATE_READY',
  'TEJ_PREPARED',
  'TRANSMITTED',
  'ACCEPTED',
  'REJECTED',
  'ARCHIVED'
);

CREATE TABLE "tax_withholding" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "status" "TaxWithholdingStatus" NOT NULL DEFAULT 'DETECTED',
  "applicable" BOOLEAN,
  "decision_reason" TEXT NOT NULL,
  "decision_code" TEXT NOT NULL,
  "supplier_id" UUID,
  "ap_bill_id" UUID,
  "ap_payment_id" UUID,
  "vendor_name" TEXT NOT NULL,
  "base_amount" DECIMAL(18,3) NOT NULL,
  "rate_bps" INTEGER,
  "withholding_amount" DECIMAL(18,3) NOT NULL DEFAULT 0,
  "net_payable" DECIMAL(18,3),
  "currency" TEXT NOT NULL DEFAULT 'TND',
  "law_ref" TEXT,
  "period_label" TEXT,
  "prefs_snapshot_json" JSONB NOT NULL DEFAULT '{}',
  "is_stub_rate" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "tax_withholding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tax_withholding_company_id_status_idx" ON "tax_withholding"("company_id", "status");
CREATE INDEX "tax_withholding_company_id_period_label_idx" ON "tax_withholding"("company_id", "period_label");
CREATE INDEX "tax_withholding_company_id_created_at_idx" ON "tax_withholding"("company_id", "created_at" DESC);
CREATE INDEX "tax_withholding_company_id_ap_payment_id_idx" ON "tax_withholding"("company_id", "ap_payment_id");
CREATE INDEX "tax_withholding_company_id_supplier_id_idx" ON "tax_withholding"("company_id", "supplier_id");
