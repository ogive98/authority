-- D250 — Supplier master Soft Glass V0 + optional FinApBill.supplier_id

CREATE TYPE "SupSupplierCategory" AS ENUM ('LAIT', 'EMBALLAGE', 'FOURNITURE', 'IMPORT');
CREATE TYPE "SupSupplierStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'BLOCKED', 'ARCHIVED');

CREATE TABLE "sup_supplier" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "category" "SupSupplierCategory" NOT NULL DEFAULT 'FOURNITURE',
    "lead_time_days" INTEGER,
    "moq_default" DECIMAL(18,3),
    "preferred" BOOLEAN NOT NULL DEFAULT false,
    "quality_hold" BOOLEAN NOT NULL DEFAULT false,
    "payment_terms" TEXT,
    "notes" TEXT,
    "status" "SupSupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "sup_supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sup_contact" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "role" TEXT,
    "language" VARCHAR(8),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "sup_contact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sup_supplier_company_id_code_key" ON "sup_supplier"("company_id", "code");
CREATE UNIQUE INDEX "sup_supplier_company_id_party_id_key" ON "sup_supplier"("company_id", "party_id");
CREATE INDEX "sup_supplier_company_id_created_at_idx" ON "sup_supplier"("company_id", "created_at" DESC);
CREATE INDEX "sup_supplier_company_id_status_idx" ON "sup_supplier"("company_id", "status");
CREATE INDEX "sup_supplier_company_id_category_idx" ON "sup_supplier"("company_id", "category");
CREATE INDEX "sup_supplier_company_id_preferred_idx" ON "sup_supplier"("company_id", "preferred");

CREATE INDEX "sup_contact_company_id_supplier_id_created_at_idx" ON "sup_contact"("company_id", "supplier_id", "created_at" DESC);
CREATE INDEX "sup_contact_company_id_supplier_id_is_primary_idx" ON "sup_contact"("company_id", "supplier_id", "is_primary");

ALTER TABLE "sup_supplier" ADD CONSTRAINT "sup_supplier_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "md_party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sup_contact" ADD CONSTRAINT "sup_contact_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "sup_supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fin_ap_bill" ADD COLUMN "supplier_id" UUID;
CREATE INDEX "fin_ap_bill_company_id_supplier_id_idx" ON "fin_ap_bill"("company_id", "supplier_id");
ALTER TABLE "fin_ap_bill" ADD CONSTRAINT "fin_ap_bill_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "sup_supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
