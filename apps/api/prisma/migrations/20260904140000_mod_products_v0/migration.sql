-- CreateEnum
CREATE TYPE "PrdProductType" AS ENUM ('RAW_MATERIAL', 'SUPPLY', 'PACKAGING', 'CONSUMABLE', 'FINISHED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "PrdStorageClass" AS ENUM ('COLD', 'DRY', 'AMBIENT');

-- CreateEnum
CREATE TYPE "PrdProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'OBSOLETE');

-- CreateTable
CREATE TABLE "prd_product" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PrdProductType" NOT NULL,
    "uom" TEXT NOT NULL,
    "track_lot" BOOLEAN NOT NULL DEFAULT false,
    "perishable" BOOLEAN NOT NULL DEFAULT false,
    "storage_class" "PrdStorageClass" NOT NULL,
    "allergen_flags" JSONB NOT NULL DEFAULT '[]',
    "status" "PrdProductStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "prd_product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prd_product_company_id_created_at_idx" ON "prd_product"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "prd_product_company_id_status_idx" ON "prd_product"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "prd_product_company_id_sku_key" ON "prd_product"("company_id", "sku");
