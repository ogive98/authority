-- D259 Tax Engine — kinds / calc methods / rule status / tax_line snapshot
-- Existing VAT codes backfilled ACTIVE. New non-VAT rules default DRAFT.
-- FODEC / timbre / RAS / TEJ stay in Prefs (D090/D092). No cheese-tax seed.

DO $$ BEGIN
  ALTER TYPE "TaxKind" ADD VALUE IF NOT EXISTS 'WITHHOLDING';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "TaxKind" ADD VALUE IF NOT EXISTS 'SPECIFIC_TAX';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "TaxKind" ADD VALUE IF NOT EXISTS 'DUTY';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "TaxKind" ADD VALUE IF NOT EXISTS 'CONTRIBUTION';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "TaxKind" ADD VALUE IF NOT EXISTS 'EXEMPTION';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "TaxKind" ADD VALUE IF NOT EXISTS 'DEDUCTION';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "TaxKind" ADD VALUE IF NOT EXISTS 'OTHER';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TYPE "TaxCalcMethod" AS ENUM ('RATE', 'FIXED', 'QTY');
CREATE TYPE "TaxRuleStatus" AS ENUM ('DRAFT', 'PENDING_EXPERT', 'VALIDATED', 'ACTIVE', 'INACTIVE');
CREATE TYPE "TaxDecisionSource" AS ENUM ('SYSTEM_RULE', 'CLIENT_OVERRIDE', 'EXEMPTION', 'MANUAL_OVERRIDE');
CREATE TYPE "FinInvoiceLineType" AS ENUM ('PRODUCT', 'TAX');

ALTER TABLE "tax_code"
  ADD COLUMN "calc_method" "TaxCalcMethod" NOT NULL DEFAULT 'RATE',
  ADD COLUMN "status" "TaxRuleStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "unit" TEXT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'TND',
  ADD COLUMN "description" TEXT,
  ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "law_ref" TEXT,
  ADD COLUMN "validated_by" UUID,
  ADD COLUMN "validated_at" TIMESTAMPTZ(6),
  ADD COLUMN "validation_comment" TEXT;

UPDATE "tax_code"
SET
  "status" = 'ACTIVE',
  "calc_method" = 'RATE',
  "validated_at" = COALESCE("validated_at", CURRENT_TIMESTAMP)
WHERE "kind" = 'VAT' AND "deleted_at" IS NULL;

ALTER TABLE "tax_code" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

CREATE INDEX "tax_code_company_id_status_kind_idx" ON "tax_code"("company_id", "status", "kind");

ALTER TABLE "tax_rate"
  ADD COLUMN "calc_method" "TaxCalcMethod" NOT NULL DEFAULT 'RATE',
  ADD COLUMN "amount_milli" INTEGER,
  ADD COLUMN "unit" TEXT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'TND',
  ADD COLUMN "status" "TaxRuleStatus" NOT NULL DEFAULT 'VALIDATED',
  ADD COLUMN "validated_by" UUID,
  ADD COLUMN "validation_comment" TEXT;

UPDATE "tax_rate"
SET "status" = 'VALIDATED', "calc_method" = 'RATE'
WHERE "deleted_at" IS NULL;

CREATE INDEX "tax_rate_company_id_status_idx" ON "tax_rate"("company_id", "status");

CREATE TABLE "tax_line" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID,
    "line_no" INTEGER,
    "tax_code_id" UUID NOT NULL,
    "tax_rate_id" UUID,
    "rule_version" INTEGER NOT NULL,
    "tax_code" TEXT NOT NULL,
    "tax_name" TEXT NOT NULL,
    "kind" "TaxKind" NOT NULL,
    "calc_method" "TaxCalcMethod" NOT NULL,
    "rate_bps" INTEGER,
    "amount_milli" INTEGER,
    "base" DECIMAL(18,3) NOT NULL,
    "taxable_quantity" DECIMAL(18,3),
    "unit" TEXT,
    "calculated_amount" DECIMAL(18,3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "applicable" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT NOT NULL,
    "source" "TaxDecisionSource" NOT NULL DEFAULT 'SYSTEM_RULE',
    "law_ref" TEXT,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL,
    "frozen" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tax_line_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tax_line_company_id_source_type_source_id_idx" ON "tax_line"("company_id", "source_type", "source_id");
CREATE INDEX "tax_line_company_id_tax_code_id_idx" ON "tax_line"("company_id", "tax_code_id");
CREATE INDEX "tax_line_company_id_created_at_idx" ON "tax_line"("company_id", "created_at" DESC);
CREATE INDEX "tax_line_company_id_frozen_idx" ON "tax_line"("company_id", "frozen");

ALTER TABLE "tax_line" ADD CONSTRAINT "tax_line_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tax_line" ADD CONSTRAINT "tax_line_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "tax_rate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fin_invoice_line"
  ADD COLUMN "line_type" "FinInvoiceLineType" NOT NULL DEFAULT 'PRODUCT',
  ADD COLUMN "product_id" UUID,
  ADD COLUMN "tax_line_id" UUID;

CREATE INDEX "fin_invoice_line_company_id_product_id_idx" ON "fin_invoice_line"("company_id", "product_id");
CREATE INDEX "fin_invoice_line_company_id_line_type_idx" ON "fin_invoice_line"("company_id", "line_type");

ALTER TABLE "fin_invoice_line" ADD CONSTRAINT "fin_invoice_line_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "prd_product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fin_invoice_line" ADD CONSTRAINT "fin_invoice_line_tax_line_id_fkey" FOREIGN KEY ("tax_line_id") REFERENCES "tax_line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fin_credit_note_line"
  ADD COLUMN "line_type" "FinInvoiceLineType" NOT NULL DEFAULT 'PRODUCT',
  ADD COLUMN "product_id" UUID,
  ADD COLUMN "tax_line_id" UUID;

CREATE INDEX "fin_credit_note_line_company_id_product_id_idx" ON "fin_credit_note_line"("company_id", "product_id");
CREATE INDEX "fin_credit_note_line_company_id_line_type_idx" ON "fin_credit_note_line"("company_id", "line_type");

ALTER TABLE "fin_credit_note_line" ADD CONSTRAINT "fin_credit_note_line_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "prd_product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fin_credit_note_line" ADD CONSTRAINT "fin_credit_note_line_tax_line_id_fkey" FOREIGN KEY ("tax_line_id") REFERENCES "tax_line"("id") ON DELETE SET NULL ON UPDATE CASCADE;
