-- CreateTable
CREATE TABLE "csh_collection" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "driver_id" UUID NOT NULL,
    "amount" DECIMAL(18,3) NOT NULL,
    "collected_at" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "csh_collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csh_close" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "cashier_id" UUID NOT NULL,
    "expected_amt" DECIMAL(18,3) NOT NULL,
    "actual_amt" DECIMAL(18,3) NOT NULL,
    "variance" DECIMAL(18,3) NOT NULL,
    "closed_at" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "csh_close_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "csh_collection_company_id_created_at_idx" ON "csh_collection"("company_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "csh_collection_company_id_number_key" ON "csh_collection"("company_id", "number");

-- CreateIndex
CREATE INDEX "csh_close_company_id_created_at_idx" ON "csh_close"("company_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "csh_close_company_id_number_key" ON "csh_close"("company_id", "number");

