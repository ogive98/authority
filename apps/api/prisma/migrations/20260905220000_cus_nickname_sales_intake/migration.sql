-- Customer nickname (surnom) for order intake autocomplete

ALTER TABLE "cus_customer" ADD COLUMN "nickname" TEXT;
CREATE INDEX "cus_customer_company_id_nickname_idx" ON "cus_customer"("company_id", "nickname");
