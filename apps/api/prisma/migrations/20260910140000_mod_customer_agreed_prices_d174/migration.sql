-- D174: Customer agreed prices (HT TND per customer × product)
CREATE TABLE "cus_customer_price" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "unit_price_ht" DECIMAL(18,3) NOT NULL,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'TND',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cus_customer_price_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cus_customer_price_company_id_customer_id_product_id_key"
  ON "cus_customer_price"("company_id", "customer_id", "product_id");

CREATE INDEX "cus_customer_price_company_id_customer_id_idx"
  ON "cus_customer_price"("company_id", "customer_id");

CREATE INDEX "cus_customer_price_company_id_product_id_idx"
  ON "cus_customer_price"("company_id", "product_id");

ALTER TABLE "cus_customer_price"
  ADD CONSTRAINT "cus_customer_price_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "cus_customer"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
