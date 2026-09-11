-- AP bank recon V0 (D205) — disbursements + XOR match on debit lines.
-- No supplier master, no AP bills, no GL.

CREATE TABLE "fin_ap_payment" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "amount" DECIMAL(18,3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "method" "FinPaymentMethod" NOT NULL DEFAULT 'OTHER',
    "status" "FinPaymentStatus" NOT NULL DEFAULT 'POSTED',
    "payment_date" DATE NOT NULL,
    "accounting_date" DATE NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "fin_ap_payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fin_ap_payment_company_id_number_key" ON "fin_ap_payment"("company_id", "number");
CREATE INDEX "fin_ap_payment_company_id_payment_date_idx" ON "fin_ap_payment"("company_id", "payment_date" DESC);
CREATE INDEX "fin_ap_payment_company_id_status_idx" ON "fin_ap_payment"("company_id", "status");

ALTER TABLE "fin_bank_match" ADD COLUMN "ap_payment_id" UUID;

CREATE UNIQUE INDEX "fin_bank_match_ap_payment_id_key" ON "fin_bank_match"("ap_payment_id");

ALTER TABLE "fin_bank_match" ADD CONSTRAINT "fin_bank_match_ap_payment_id_fkey"
  FOREIGN KEY ("ap_payment_id") REFERENCES "fin_ap_payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fin_bank_match" ADD CONSTRAINT "fin_bank_match_xor_target_check" CHECK (
  (CASE WHEN "payment_id" IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN "instrument_id" IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN "ap_payment_id" IS NOT NULL THEN 1 ELSE 0 END)
  = 1
);
