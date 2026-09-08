-- Finance Promise-to-pay V0 (D087)

CREATE TYPE "FinPromiseStatus" AS ENUM ('OPEN', 'KEPT', 'BROKEN', 'CANCELLED');

CREATE TABLE "fin_promise_to_pay" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "open_item_id" UUID NOT NULL,
    "amount" DECIMAL(18,3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "promised_date" DATE NOT NULL,
    "status" "FinPromiseStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "fin_promise_to_pay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fin_promise_to_pay_company_id_number_key" ON "fin_promise_to_pay"("company_id", "number");
CREATE INDEX "fin_promise_to_pay_company_id_status_promised_date_idx" ON "fin_promise_to_pay"("company_id", "status", "promised_date");
CREATE INDEX "fin_promise_to_pay_company_id_customer_id_idx" ON "fin_promise_to_pay"("company_id", "customer_id");
CREATE INDEX "fin_promise_to_pay_company_id_open_item_id_idx" ON "fin_promise_to_pay"("company_id", "open_item_id");
CREATE INDEX "fin_promise_to_pay_company_id_created_at_idx" ON "fin_promise_to_pay"("company_id", "created_at" DESC);

ALTER TABLE "fin_promise_to_pay" ADD CONSTRAINT "fin_promise_to_pay_open_item_id_fkey" FOREIGN KEY ("open_item_id") REFERENCES "fin_open_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
