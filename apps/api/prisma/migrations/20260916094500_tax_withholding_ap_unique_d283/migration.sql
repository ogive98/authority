-- D283 — one TaxWithholding per AP payment (NULL ap_payment_id allowed multiple times in PG UNIQUE)
DROP INDEX IF EXISTS "tax_withholding_company_id_ap_payment_id_idx";

CREATE UNIQUE INDEX "tax_withholding_company_id_ap_payment_id_key"
  ON "tax_withholding"("company_id", "ap_payment_id");
