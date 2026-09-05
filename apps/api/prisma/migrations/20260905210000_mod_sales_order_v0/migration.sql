-- Sales Order V0

CREATE TYPE "SalOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

CREATE TABLE "sal_order" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "status" "SalOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "requested_date" DATE,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "notes" TEXT,
    "amount_total" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "confirmed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "sal_order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sal_order_line" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "unit_price" DECIMAL(18,3) NOT NULL,
    "discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(18,3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sal_order_line_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sal_order_company_id_number_key" ON "sal_order"("company_id", "number");
CREATE INDEX "sal_order_company_id_created_at_idx" ON "sal_order"("company_id", "created_at" DESC);
CREATE INDEX "sal_order_company_id_status_idx" ON "sal_order"("company_id", "status");
CREATE INDEX "sal_order_company_id_customer_id_idx" ON "sal_order"("company_id", "customer_id");

CREATE UNIQUE INDEX "sal_order_line_order_id_line_no_key" ON "sal_order_line"("order_id", "line_no");
CREATE INDEX "sal_order_line_company_id_order_id_idx" ON "sal_order_line"("company_id", "order_id");

ALTER TABLE "sal_order_line" ADD CONSTRAINT "sal_order_line_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sal_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
