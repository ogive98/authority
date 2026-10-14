-- CreateEnum
CREATE TYPE "BomRecipeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'OBSOLETE');

-- CreateTable
CREATE TABLE "bom_recipe" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "product_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "BomRecipeStatus" NOT NULL DEFAULT 'DRAFT',
    "yield" DECIMAL(18,3) NOT NULL DEFAULT 1,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "bom_recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_line" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "uom" TEXT NOT NULL,
    "scrap_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "step" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bom_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cst_roll" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "std_cost" DECIMAL(18,3) NOT NULL,
    "posted_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cst_roll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cst_lot" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "unit_cost" DECIMAL(18,3) NOT NULL,
    "total_cost" DECIMAL(18,3) NOT NULL,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cst_lot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bom_recipe_company_id_created_at_idx" ON "bom_recipe"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "bom_recipe_company_id_status_idx" ON "bom_recipe"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bom_recipe_company_id_number_key" ON "bom_recipe"("company_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "bom_recipe_company_id_product_id_version_key" ON "bom_recipe"("company_id", "product_id", "version");

-- CreateIndex
CREATE INDEX "bom_line_company_id_recipe_id_idx" ON "bom_line"("company_id", "recipe_id");

-- CreateIndex
CREATE INDEX "cst_roll_company_id_created_at_idx" ON "cst_roll"("company_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "cst_roll_company_id_product_id_period_key" ON "cst_roll"("company_id", "product_id", "period");

-- CreateIndex
CREATE INDEX "cst_lot_company_id_created_at_idx" ON "cst_lot"("company_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "cst_lot_company_id_lot_id_key" ON "cst_lot"("company_id", "lot_id");

-- AddForeignKey
ALTER TABLE "bom_line" ADD CONSTRAINT "bom_line_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "bom_recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

