-- Inventory light: warehouses, balances, movements

CREATE TYPE "InvMovementType" AS ENUM ('ADJUST', 'RESERVE', 'RELEASE');

CREATE TABLE "inv_warehouse" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "inv_warehouse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inv_balance" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "on_hand" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inv_balance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inv_movement" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "balance_id" UUID NOT NULL,
    "type" "InvMovementType" NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "on_hand_after" DECIMAL(18,3) NOT NULL,
    "reserved_after" DECIMAL(18,3) NOT NULL,
    "reason" TEXT,
    "ref_type" TEXT,
    "ref_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inv_movement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inv_warehouse_company_id_code_key" ON "inv_warehouse"("company_id", "code");
CREATE INDEX "inv_warehouse_company_id_active_idx" ON "inv_warehouse"("company_id", "active");

CREATE UNIQUE INDEX "inv_balance_company_id_warehouse_id_product_id_key" ON "inv_balance"("company_id", "warehouse_id", "product_id");
CREATE INDEX "inv_balance_company_id_product_id_idx" ON "inv_balance"("company_id", "product_id");
CREATE INDEX "inv_balance_company_id_warehouse_id_idx" ON "inv_balance"("company_id", "warehouse_id");

CREATE INDEX "inv_movement_company_id_balance_id_created_at_idx" ON "inv_movement"("company_id", "balance_id", "created_at" DESC);
CREATE INDEX "inv_movement_company_id_created_at_idx" ON "inv_movement"("company_id", "created_at" DESC);

ALTER TABLE "inv_balance" ADD CONSTRAINT "inv_balance_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inv_warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inv_movement" ADD CONSTRAINT "inv_movement_balance_id_fkey" FOREIGN KEY ("balance_id") REFERENCES "inv_balance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
