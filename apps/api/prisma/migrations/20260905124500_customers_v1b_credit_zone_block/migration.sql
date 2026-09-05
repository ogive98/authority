-- Customers V1b: delivery zones, credit limit, block flag

CREATE TABLE "cus_zone" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cus_zone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cus_zone_company_id_code_key" ON "cus_zone"("company_id", "code");
CREATE INDEX "cus_zone_company_id_active_idx" ON "cus_zone"("company_id", "active");

ALTER TABLE "cus_customer" ADD COLUMN "credit_limit" DECIMAL(18,3),
ADD COLUMN "zone_id" UUID,
ADD COLUMN "blocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "blocked_at" TIMESTAMPTZ(6),
ADD COLUMN "blocked_reason" TEXT;

CREATE INDEX "cus_customer_company_id_blocked_idx" ON "cus_customer"("company_id", "blocked");
CREATE INDEX "cus_customer_company_id_zone_id_idx" ON "cus_customer"("company_id", "zone_id");

ALTER TABLE "cus_customer" ADD CONSTRAINT "cus_customer_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "cus_zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
