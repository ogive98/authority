-- D276 AP bill tax lines (engine snapshot — no invented rates).

ALTER TABLE "fin_ap_bill" ADD COLUMN IF NOT EXISTS "amount_ht" DECIMAL(18,3) NOT NULL DEFAULT 0;
ALTER TABLE "fin_ap_bill" ADD COLUMN IF NOT EXISTS "amount_tax" DECIMAL(18,3) NOT NULL DEFAULT 0;

CREATE TABLE "fin_ap_bill_line" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "bill_id" UUID NOT NULL,
  "line_no" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "amount_ht" DECIMAL(18,3) NOT NULL,
  "amount_tax" DECIMAL(18,3) NOT NULL,
  "amount_ttc" DECIMAL(18,3) NOT NULL,
  "tax_code_id" UUID NOT NULL,
  "tax_line_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "fin_ap_bill_line_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fin_ap_bill_line_bill_id_line_no_key" ON "fin_ap_bill_line"("bill_id", "line_no");
CREATE INDEX "fin_ap_bill_line_company_id_bill_id_idx" ON "fin_ap_bill_line"("company_id", "bill_id");

ALTER TABLE "fin_ap_bill_line" ADD CONSTRAINT "fin_ap_bill_line_bill_id_fkey"
  FOREIGN KEY ("bill_id") REFERENCES "fin_ap_bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fin_ap_bill_line" ADD CONSTRAINT "fin_ap_bill_line_tax_code_id_fkey"
  FOREIGN KEY ("tax_code_id") REFERENCES "tax_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fin_ap_bill_line" ADD CONSTRAINT "fin_ap_bill_line_tax_line_id_fkey"
  FOREIGN KEY ("tax_line_id") REFERENCES "tax_line"("id") ON DELETE SET NULL ON UPDATE CASCADE;
