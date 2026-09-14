-- D236 — AP vendor bills V0 (vendorName free text, no supplier master, no GL)

CREATE TYPE "FinApBillStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

CREATE TABLE "fin_ap_bill" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "status" "FinApBillStatus" NOT NULL DEFAULT 'DRAFT',
    "bill_date" DATE NOT NULL,
    "due_date" DATE,
    "amount_total" DECIMAL(18,3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "label" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "posted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "fin_ap_bill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fin_ap_bill_company_id_number_key" ON "fin_ap_bill"("company_id", "number");
CREATE INDEX "fin_ap_bill_company_id_bill_date_idx" ON "fin_ap_bill"("company_id", "bill_date" DESC);
CREATE INDEX "fin_ap_bill_company_id_status_idx" ON "fin_ap_bill"("company_id", "status");
