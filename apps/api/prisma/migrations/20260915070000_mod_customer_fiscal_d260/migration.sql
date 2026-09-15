-- D260 Customer fiscal profile + per-code overrides (Phase 3)
-- No legal rates seeded. NEVER requires justification. ALWAYS cannot force PENDING_EXPERT.

CREATE TYPE "CusFiscalOverrideMode" AS ENUM ('AUTO', 'ALWAYS', 'NEVER', 'CONFIRM');

CREATE TABLE "cus_fiscal_profile" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "fiscal_regime" TEXT,
    "vat_liable" BOOLEAN,
    "fiscal_status" TEXT,
    "fiscal_category" TEXT,
    "withholding_ar_enabled" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cus_fiscal_profile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cus_fiscal_profile_customer_id_key" ON "cus_fiscal_profile"("customer_id");
CREATE INDEX "cus_fiscal_profile_company_id_customer_id_idx" ON "cus_fiscal_profile"("company_id", "customer_id");

ALTER TABLE "cus_fiscal_profile" ADD CONSTRAINT "cus_fiscal_profile_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "cus_customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cus_fiscal_rule_override" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "tax_code_id" UUID NOT NULL,
    "mode" "CusFiscalOverrideMode" NOT NULL DEFAULT 'AUTO',
    "source" "TaxDecisionSource" NOT NULL DEFAULT 'CLIENT_OVERRIDE',
    "valid_from" DATE,
    "valid_to" DATE,
    "justification" TEXT,
    "reference" TEXT,
    "document_id" UUID,
    "comment" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cus_fiscal_rule_override_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cus_fiscal_rule_override_company_id_customer_id_tax_code_id_key" ON "cus_fiscal_rule_override"("company_id", "customer_id", "tax_code_id");
CREATE INDEX "cus_fiscal_rule_override_company_id_customer_id_idx" ON "cus_fiscal_rule_override"("company_id", "customer_id");
CREATE INDEX "cus_fiscal_rule_override_company_id_tax_code_id_idx" ON "cus_fiscal_rule_override"("company_id", "tax_code_id");

ALTER TABLE "cus_fiscal_rule_override" ADD CONSTRAINT "cus_fiscal_rule_override_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "cus_customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cus_fiscal_rule_override" ADD CONSTRAINT "cus_fiscal_rule_override_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
