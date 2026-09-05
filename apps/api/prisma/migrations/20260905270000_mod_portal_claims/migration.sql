-- Portal P6 claims light: customer-owned réclamations (docs downloads deferred)

CREATE TYPE "PtlClaimType" AS ENUM ('DELIVERY', 'QUALITY', 'QUANTITY', 'BILLING', 'OTHER');
CREATE TYPE "PtlClaimStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'RESOLVED', 'CLOSED');

CREATE TABLE "ptl_claim" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "type" "PtlClaimType" NOT NULL,
    "status" "PtlClaimStatus" NOT NULL DEFAULT 'OPEN',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order_id" UUID,
    "shipment_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "resolution_note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "ptl_claim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ptl_claim_company_id_number_key" ON "ptl_claim"("company_id", "number");
CREATE INDEX "ptl_claim_company_id_customer_id_created_at_idx" ON "ptl_claim"("company_id", "customer_id", "created_at" DESC);
CREATE INDEX "ptl_claim_company_id_status_idx" ON "ptl_claim"("company_id", "status");
