-- D096 Inventory Lots V0
CREATE TYPE "InvLotStatus" AS ENUM ('OPEN', 'QUARANTINE', 'CLOSED');

CREATE TABLE "inv_lot" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "lot_code" TEXT NOT NULL,
    "qty_on_hand" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "qty_reserved" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "dlc" DATE,
    "status" "InvLotStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inv_lot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inv_lot_company_id_warehouse_id_product_id_lot_code_key"
  ON "inv_lot"("company_id", "warehouse_id", "product_id", "lot_code");

CREATE INDEX "inv_lot_company_id_product_id_idx" ON "inv_lot"("company_id", "product_id");
CREATE INDEX "inv_lot_company_id_warehouse_id_idx" ON "inv_lot"("company_id", "warehouse_id");
CREATE INDEX "inv_lot_company_id_status_dlc_idx" ON "inv_lot"("company_id", "status", "dlc");

ALTER TABLE "inv_lot"
  ADD CONSTRAINT "inv_lot_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "inv_warehouse"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inv_movement" ADD COLUMN "lot_id" UUID;

CREATE INDEX "inv_movement_company_id_lot_id_created_at_idx"
  ON "inv_movement"("company_id", "lot_id", "created_at" DESC);

ALTER TABLE "inv_movement"
  ADD CONSTRAINT "inv_movement_lot_id_fkey"
  FOREIGN KEY ("lot_id") REFERENCES "inv_lot"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
