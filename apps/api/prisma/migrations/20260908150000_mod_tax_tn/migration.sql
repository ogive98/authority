-- Tax Engine TVA Tunisie V0 (D088) + invoice lines HT/TVA/TTC

CREATE TYPE "TaxKind" AS ENUM ('VAT');

CREATE TABLE "tax_code" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "TaxKind" NOT NULL DEFAULT 'VAT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tax_code_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tax_code_company_id_code_key" ON "tax_code"("company_id", "code");
CREATE INDEX "tax_code_company_id_kind_active_idx" ON "tax_code"("company_id", "kind", "active");

CREATE TABLE "tax_rate" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "tax_code_id" UUID NOT NULL,
    "rate_bps" INTEGER NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "law_ref" TEXT,
    "expert_validated_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tax_rate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tax_rate_company_id_tax_code_id_valid_from_idx" ON "tax_rate"("company_id", "tax_code_id", "valid_from");
CREATE INDEX "tax_rate_company_id_valid_from_idx" ON "tax_rate"("company_id", "valid_from");

ALTER TABLE "tax_rate" ADD CONSTRAINT "tax_rate_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_code"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fin_invoice" ADD COLUMN "amount_ht" DECIMAL(18,3) NOT NULL DEFAULT 0;
ALTER TABLE "fin_invoice" ADD COLUMN "amount_tax" DECIMAL(18,3) NOT NULL DEFAULT 0;

UPDATE "fin_invoice" SET "amount_ht" = "amount_total", "amount_tax" = 0 WHERE "amount_ht" = 0;

CREATE TABLE "fin_invoice_line" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "unit_price_ht" DECIMAL(18,3) NOT NULL,
    "tax_code_id" UUID NOT NULL,
    "amount_ht" DECIMAL(18,3) NOT NULL,
    "amount_tax" DECIMAL(18,3) NOT NULL,
    "amount_ttc" DECIMAL(18,3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "fin_invoice_line_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fin_invoice_line_invoice_id_line_no_key" ON "fin_invoice_line"("invoice_id", "line_no");
CREATE INDEX "fin_invoice_line_company_id_invoice_id_idx" ON "fin_invoice_line"("company_id", "invoice_id");

ALTER TABLE "fin_invoice_line" ADD CONSTRAINT "fin_invoice_line_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "fin_invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fin_invoice_line" ADD CONSTRAINT "fin_invoice_line_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
