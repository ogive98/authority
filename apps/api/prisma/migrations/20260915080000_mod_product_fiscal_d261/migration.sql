-- D261 Product fiscal profile + per-code overrides (Phase 4)
-- Classification only. No cheese-tax / 4386 / 3 DT/kg seed.

CREATE TYPE "PrdFiscalOverrideMode" AS ENUM ('AUTO', 'ALWAYS', 'NEVER', 'CONFIRM');

CREATE TABLE "prd_fiscal_profile" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "default_vat_tax_code_id" UUID,
    "hs_code" TEXT,
    "fiscal_category" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "prd_fiscal_profile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "prd_fiscal_profile_product_id_key" ON "prd_fiscal_profile"("product_id");
CREATE INDEX "prd_fiscal_profile_company_id_product_id_idx" ON "prd_fiscal_profile"("company_id", "product_id");

ALTER TABLE "prd_fiscal_profile" ADD CONSTRAINT "prd_fiscal_profile_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "prd_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prd_fiscal_profile" ADD CONSTRAINT "prd_fiscal_profile_default_vat_tax_code_id_fkey" FOREIGN KEY ("default_vat_tax_code_id") REFERENCES "tax_code"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "prd_fiscal_rule_override" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "tax_code_id" UUID NOT NULL,
    "mode" "PrdFiscalOverrideMode" NOT NULL DEFAULT 'AUTO',
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

    CONSTRAINT "prd_fiscal_rule_override_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "prd_fiscal_rule_override_company_id_product_id_tax_code_id_key" ON "prd_fiscal_rule_override"("company_id", "product_id", "tax_code_id");
CREATE INDEX "prd_fiscal_rule_override_company_id_product_id_idx" ON "prd_fiscal_rule_override"("company_id", "product_id");
CREATE INDEX "prd_fiscal_rule_override_company_id_tax_code_id_idx" ON "prd_fiscal_rule_override"("company_id", "tax_code_id");

ALTER TABLE "prd_fiscal_rule_override" ADD CONSTRAINT "prd_fiscal_rule_override_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "prd_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prd_fiscal_rule_override" ADD CONSTRAINT "prd_fiscal_rule_override_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
