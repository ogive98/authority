-- D286 AR invoice RAS + side AP/AR on tax_withholding
ALTER TABLE "tax_withholding"
  ADD COLUMN "ar_invoice_id" UUID,
  ADD COLUMN "side" TEXT NOT NULL DEFAULT 'AP';

CREATE INDEX "tax_withholding_company_id_ar_invoice_id_idx"
  ON "tax_withholding"("company_id", "ar_invoice_id");

CREATE INDEX "tax_withholding_company_id_side_idx"
  ON "tax_withholding"("company_id", "side");

CREATE UNIQUE INDEX "tax_withholding_company_id_ar_invoice_id_key"
  ON "tax_withholding"("company_id", "ar_invoice_id");
