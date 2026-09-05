-- Finance light V0: AR open items + payment allocations (no tax rate tables)

CREATE TYPE "FinOpenItemSide" AS ENUM ('AR', 'AP');
CREATE TYPE "FinOpenItemStatus" AS ENUM ('OPEN', 'PARTIAL', 'CLOSED');

CREATE TABLE "fin_open_item" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "side" "FinOpenItemSide" NOT NULL DEFAULT 'AR',
    "status" "FinOpenItemStatus" NOT NULL DEFAULT 'OPEN',
    "sales_order_id" UUID,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "amount_total" DECIMAL(18,3) NOT NULL,
    "amount_open" DECIMAL(18,3) NOT NULL,
    "due_date" DATE,
    "label" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "fin_open_item_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fin_open_item_company_id_number_key" ON "fin_open_item"("company_id", "number");
CREATE INDEX "fin_open_item_company_id_created_at_idx" ON "fin_open_item"("company_id", "created_at" DESC);
CREATE INDEX "fin_open_item_company_id_status_idx" ON "fin_open_item"("company_id", "status");
CREATE INDEX "fin_open_item_company_id_customer_id_idx" ON "fin_open_item"("company_id", "customer_id");

CREATE TABLE "fin_allocation" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "open_item_id" UUID NOT NULL,
    "amount" DECIMAL(18,3) NOT NULL,
    "paid_at" TIMESTAMPTZ(6) NOT NULL,
    "note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "fin_allocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fin_allocation_company_id_open_item_id_idx" ON "fin_allocation"("company_id", "open_item_id");
CREATE INDEX "fin_allocation_company_id_paid_at_idx" ON "fin_allocation"("company_id", "paid_at" DESC);

ALTER TABLE "fin_allocation" ADD CONSTRAINT "fin_allocation_open_item_id_fkey" FOREIGN KEY ("open_item_id") REFERENCES "fin_open_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;