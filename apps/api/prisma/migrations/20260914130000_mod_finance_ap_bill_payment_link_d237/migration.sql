-- D237 — optional FinApPayment → FinApBill link (vendorName free text, no GL)

ALTER TABLE "fin_ap_payment" ADD COLUMN "ap_bill_id" UUID;

CREATE INDEX "fin_ap_payment_company_id_ap_bill_id_idx" ON "fin_ap_payment"("company_id", "ap_bill_id");

ALTER TABLE "fin_ap_payment" ADD CONSTRAINT "fin_ap_payment_ap_bill_id_fkey" FOREIGN KEY ("ap_bill_id") REFERENCES "fin_ap_bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
