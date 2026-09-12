-- D217 — Employee identity/bank fields · attestation PDF · print template catalogue
-- Never seed CIN/contrat/attestation legal text.

ALTER TYPE "DocLinkType" ADD VALUE IF NOT EXISTS 'HR_ATTESTATION';

ALTER TABLE "hr_employee" ADD COLUMN IF NOT EXISTS "cin_no" TEXT;
ALTER TABLE "hr_employee" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "hr_employee" ADD COLUMN IF NOT EXISTS "bank_name" TEXT;
ALTER TABLE "hr_employee" ADD COLUMN IF NOT EXISTS "bank_agency" TEXT;
ALTER TABLE "hr_employee" ADD COLUMN IF NOT EXISTS "bank_account" TEXT;
ALTER TABLE "hr_employee" ADD COLUMN IF NOT EXISTS "attestation_pdf_document_id" UUID;

CREATE INDEX IF NOT EXISTS "hr_employee_company_id_attestation_pdf_document_id_idx"
  ON "hr_employee"("company_id", "attestation_pdf_document_id");

ALTER TABLE "hr_employee"
  DROP CONSTRAINT IF EXISTS "hr_employee_attestation_pdf_document_id_fkey";

ALTER TABLE "hr_employee"
  ADD CONSTRAINT "hr_employee_attestation_pdf_document_id_fkey"
  FOREIGN KEY ("attestation_pdf_document_id") REFERENCES "doc_document"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "HrPrintDocKind" AS ENUM ('CONTRACT', 'ATTESTATION');

CREATE TABLE "hr_print_template" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "kind" "HrPrintDocKind" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "letterhead" TEXT NOT NULL DEFAULT '',
    "body_html" TEXT NOT NULL DEFAULT '',
    "footer" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hr_print_template_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hr_print_template_company_id_kind_code_key"
  ON "hr_print_template"("company_id", "kind", "code");
CREATE INDEX "hr_print_template_company_id_kind_active_idx"
  ON "hr_print_template"("company_id", "kind", "active");
CREATE INDEX "hr_print_template_company_id_created_at_idx"
  ON "hr_print_template"("company_id", "created_at" DESC);
