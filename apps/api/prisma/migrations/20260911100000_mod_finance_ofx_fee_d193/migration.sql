-- D193: OFX FITID dedup + explicit bank fee GL marker
ALTER TABLE "fin_bank_statement_line" ADD COLUMN IF NOT EXISTS "fit_id" TEXT;
ALTER TABLE "fin_bank_statement_line" ADD COLUMN IF NOT EXISTS "fee_posted_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX IF NOT EXISTS "fin_bank_statement_line_bank_account_id_fit_id_key"
  ON "fin_bank_statement_line" ("bank_account_id", "fit_id");

CREATE INDEX IF NOT EXISTS "fin_bank_statement_line_company_id_fee_posted_at_idx"
  ON "fin_bank_statement_line" ("company_id", "fee_posted_at");
