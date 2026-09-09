-- D097 FEFO lot allocation ledger (pick once, consume once)
CREATE TYPE "InvLotAllocStatus" AS ENUM ('ALLOCATED', 'CONSUMED', 'RELEASED');

CREATE TABLE "inv_lot_allocation" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "status" "InvLotAllocStatus" NOT NULL DEFAULT 'ALLOCATED',
    "from_reserve" BOOLEAN NOT NULL DEFAULT true,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "consume_ref_type" TEXT,
    "consume_ref_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inv_lot_allocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inv_lot_allocation_company_id_source_type_source_id_status_idx"
  ON "inv_lot_allocation"("company_id", "source_type", "source_id", "status");

CREATE INDEX "inv_lot_allocation_company_id_consume_ref_id_status_idx"
  ON "inv_lot_allocation"("company_id", "consume_ref_id", "status");

CREATE INDEX "inv_lot_allocation_company_id_lot_id_idx"
  ON "inv_lot_allocation"("company_id", "lot_id");

ALTER TABLE "inv_lot_allocation"
  ADD CONSTRAINT "inv_lot_allocation_lot_id_fkey"
  FOREIGN KEY ("lot_id") REFERENCES "inv_lot"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
