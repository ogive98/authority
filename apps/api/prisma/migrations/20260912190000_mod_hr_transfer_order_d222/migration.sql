-- D222 — HR transfer order (salary virement) + DocLinkType

ALTER TYPE "DocLinkType" ADD VALUE IF NOT EXISTS 'HR_TRANSFER_ORDER';

CREATE TYPE "HrTransferOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

CREATE TABLE "hr_transfer_order" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "bulletin_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "amount" DECIMAL(18,3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "status" "HrTransferOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "beneficiary_name" TEXT NOT NULL,
    "beneficiary_bank_name" TEXT,
    "beneficiary_bank_agency" TEXT,
    "beneficiary_bank_account" TEXT NOT NULL,
    "company_bank_code" TEXT NOT NULL,
    "company_bank_label" TEXT NOT NULL,
    "company_bank_rib" TEXT,
    "ap_payment_id" UUID,
    "pdf_document_id" UUID,
    "created_by_user_id" UUID,
    "confirmed_by_user_id" UUID,
    "confirmed_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hr_transfer_order_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hr_transfer_order_company_id_number_key" ON "hr_transfer_order"("company_id", "number");
CREATE UNIQUE INDEX "hr_transfer_order_bulletin_id_key" ON "hr_transfer_order"("bulletin_id");
CREATE INDEX "hr_transfer_order_company_id_status_idx" ON "hr_transfer_order"("company_id", "status");
CREATE INDEX "hr_transfer_order_company_id_employee_id_idx" ON "hr_transfer_order"("company_id", "employee_id");
CREATE INDEX "hr_transfer_order_company_id_bank_account_id_idx" ON "hr_transfer_order"("company_id", "bank_account_id");
CREATE INDEX "hr_transfer_order_company_id_ap_payment_id_idx" ON "hr_transfer_order"("company_id", "ap_payment_id");

ALTER TABLE "hr_transfer_order" ADD CONSTRAINT "hr_transfer_order_bulletin_id_fkey" FOREIGN KEY ("bulletin_id") REFERENCES "hr_bulletin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_transfer_order" ADD CONSTRAINT "hr_transfer_order_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_transfer_order" ADD CONSTRAINT "hr_transfer_order_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "fin_bank_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hr_transfer_order" ADD CONSTRAINT "hr_transfer_order_ap_payment_id_fkey" FOREIGN KEY ("ap_payment_id") REFERENCES "fin_ap_payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
