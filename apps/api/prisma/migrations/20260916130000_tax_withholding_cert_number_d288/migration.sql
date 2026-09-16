-- D288 — local RAS certificate number (AUTHORITY series, not MF form)
ALTER TABLE "tax_withholding"
  ADD COLUMN "certificate_number" TEXT;

CREATE INDEX "tax_withholding_company_id_certificate_number_idx"
  ON "tax_withholding"("company_id", "certificate_number");

CREATE UNIQUE INDEX "tax_withholding_company_id_certificate_number_key"
  ON "tax_withholding"("company_id", "certificate_number");
