-- AlterTable
ALTER TABLE "proc_receipt" ADD COLUMN     "ap_bill_id" UUID;

-- CreateTable
CREATE TABLE "proc_stock_policy" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "min_qty" DECIMAL(18,3) NOT NULL,
    "safety_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "proc_stock_policy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proc_stock_policy_company_id_site_id_idx" ON "proc_stock_policy"("company_id", "site_id");

-- CreateIndex
CREATE UNIQUE INDEX "proc_stock_policy_company_id_product_id_site_id_key" ON "proc_stock_policy"("company_id", "product_id", "site_id");

