-- D317 — Customer returns / RMA (shipment-linked).

CREATE TYPE "RetRmaStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');
CREATE TYPE "RetDisposition" AS ENUM ('RESTOCK', 'SCRAP');

CREATE TABLE "ret_rma" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "shipment_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "invoice_id" UUID,
    "credit_note_id" UUID,
    "status" "RetRmaStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "posted_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "ret_rma_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ret_rma_line" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "rma_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "order_line_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "disposition" "RetDisposition" NOT NULL DEFAULT 'RESTOCK',
    "unit_price" DECIMAL(18,3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ret_rma_line_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ret_rma_company_id_number_key" ON "ret_rma"("company_id", "number");
CREATE INDEX "ret_rma_company_id_created_at_idx" ON "ret_rma"("company_id", "created_at" DESC);
CREATE INDEX "ret_rma_company_id_status_idx" ON "ret_rma"("company_id", "status");
CREATE INDEX "ret_rma_company_id_shipment_id_idx" ON "ret_rma"("company_id", "shipment_id");
CREATE INDEX "ret_rma_company_id_customer_id_idx" ON "ret_rma"("company_id", "customer_id");

CREATE UNIQUE INDEX "ret_rma_line_rma_id_line_no_key" ON "ret_rma_line"("rma_id", "line_no");
CREATE INDEX "ret_rma_line_company_id_rma_id_idx" ON "ret_rma_line"("company_id", "rma_id");
CREATE INDEX "ret_rma_line_company_id_order_line_id_idx" ON "ret_rma_line"("company_id", "order_line_id");

ALTER TABLE "ret_rma_line" ADD CONSTRAINT "ret_rma_line_rma_id_fkey" FOREIGN KEY ("rma_id") REFERENCES "ret_rma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
