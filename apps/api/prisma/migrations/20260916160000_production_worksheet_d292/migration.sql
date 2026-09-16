-- D292 Digital Worksheet Prep→Weigh→Control (Production)
CREATE TYPE "ProdWorksheetStatus" AS ENUM (
  'DRAFT',
  'PREPARED',
  'WEIGHED',
  'CONTROLLED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE "ProdWorksheetControlResult" AS ENUM ('PASS', 'FAIL');

CREATE TABLE "prd_worksheet" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "number" TEXT NOT NULL,
  "status" "ProdWorksheetStatus" NOT NULL DEFAULT 'DRAFT',
  "order_id" UUID,
  "work_order_id" UUID,
  "site_id" UUID,
  "notes" TEXT,
  "control_result" "ProdWorksheetControlResult",
  "control_note" TEXT,
  "prepared_at" TIMESTAMPTZ(6),
  "weighed_at" TIMESTAMPTZ(6),
  "controlled_at" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "prd_worksheet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "prd_worksheet_company_id_number_key" ON "prd_worksheet"("company_id", "number");
CREATE INDEX "prd_worksheet_company_id_created_at_idx" ON "prd_worksheet"("company_id", "created_at" DESC);
CREATE INDEX "prd_worksheet_company_id_status_idx" ON "prd_worksheet"("company_id", "status");

CREATE TABLE "prd_worksheet_line" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "worksheet_id" UUID NOT NULL,
  "line_no" INTEGER NOT NULL,
  "product_id" UUID NOT NULL,
  "requested_qty" DECIMAL(18,3) NOT NULL,
  "prepared_qty" DECIMAL(18,3),
  "weighed_qty" DECIMAL(18,3),
  "unit" VARCHAR(16) NOT NULL DEFAULT 'KG',
  "lot" VARCHAR(64),
  "notes" TEXT,
  CONSTRAINT "prd_worksheet_line_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "prd_worksheet_line_worksheet_id_line_no_key" ON "prd_worksheet_line"("worksheet_id", "line_no");
CREATE INDEX "prd_worksheet_line_company_id_worksheet_id_idx" ON "prd_worksheet_line"("company_id", "worksheet_id");

ALTER TABLE "prd_worksheet_line"
  ADD CONSTRAINT "prd_worksheet_line_worksheet_id_fkey"
  FOREIGN KEY ("worksheet_id") REFERENCES "prd_worksheet"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
