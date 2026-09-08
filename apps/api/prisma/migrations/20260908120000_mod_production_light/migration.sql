-- Production light: work orders, consumption, output, scrap

CREATE TYPE "ProdWoStatus" AS ENUM (
  'PLANNED',
  'RELEASED',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED'
);

CREATE TABLE "prd_wo" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "planned_qty" DECIMAL(18,3) NOT NULL,
    "actual_qty" DECIMAL(18,3),
    "lot_out" TEXT,
    "status" "ProdWoStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "prd_wo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prd_wo_cons" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "lot_in" TEXT,
    "posted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prd_wo_cons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prd_wo_out" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "lot_out" TEXT,
    "posted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prd_wo_out_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prd_scrap" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "reason" TEXT,
    "posted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prd_scrap_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "prd_wo_company_id_number_key" ON "prd_wo"("company_id", "number");
CREATE INDEX "prd_wo_company_id_created_at_idx" ON "prd_wo"("company_id", "created_at" DESC);
CREATE INDEX "prd_wo_company_id_status_idx" ON "prd_wo"("company_id", "status");

CREATE INDEX "prd_wo_cons_company_id_work_order_id_idx" ON "prd_wo_cons"("company_id", "work_order_id");
CREATE INDEX "prd_wo_out_company_id_work_order_id_idx" ON "prd_wo_out"("company_id", "work_order_id");
CREATE INDEX "prd_scrap_company_id_work_order_id_idx" ON "prd_scrap"("company_id", "work_order_id");

ALTER TABLE "prd_wo_cons" ADD CONSTRAINT "prd_wo_cons_work_order_id_fkey"
  FOREIGN KEY ("work_order_id") REFERENCES "prd_wo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prd_wo_out" ADD CONSTRAINT "prd_wo_out_work_order_id_fkey"
  FOREIGN KEY ("work_order_id") REFERENCES "prd_wo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prd_scrap" ADD CONSTRAINT "prd_scrap_work_order_id_fkey"
  FOREIGN KEY ("work_order_id") REFERENCES "prd_wo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
