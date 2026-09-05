-- Delivery light: rounds + shipments

CREATE TYPE "DlvShipmentStatus" AS ENUM ('READY', 'ASSIGNED', 'OUT', 'DELIVERED', 'FAILED');
CREATE TYPE "DlvRoundStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE');

CREATE TABLE "dlv_round" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "driver_label" TEXT NOT NULL,
    "status" "DlvRoundStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "dlv_round_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dlv_shipment" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "order_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "round_id" UUID,
    "status" "DlvShipmentStatus" NOT NULL DEFAULT 'READY',
    "driver_label" TEXT,
    "preferred_driver" TEXT,
    "fail_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "assigned_at" TIMESTAMPTZ(6),
    "dispatched_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "dlv_shipment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dlv_round_company_id_date_idx" ON "dlv_round"("company_id", "date" DESC);
CREATE INDEX "dlv_round_company_id_status_idx" ON "dlv_round"("company_id", "status");

CREATE UNIQUE INDEX "dlv_shipment_company_id_number_key" ON "dlv_shipment"("company_id", "number");
CREATE UNIQUE INDEX "dlv_shipment_company_id_order_id_key" ON "dlv_shipment"("company_id", "order_id");
CREATE INDEX "dlv_shipment_company_id_created_at_idx" ON "dlv_shipment"("company_id", "created_at" DESC);
CREATE INDEX "dlv_shipment_company_id_status_idx" ON "dlv_shipment"("company_id", "status");

ALTER TABLE "dlv_shipment" ADD CONSTRAINT "dlv_shipment_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "dlv_round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Stock issue on delivery complete
ALTER TYPE "InvMovementType" ADD VALUE IF NOT EXISTS 'ISSUE';
