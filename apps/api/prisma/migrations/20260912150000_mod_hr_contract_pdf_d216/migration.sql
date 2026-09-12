-- D216 — contract PDF link type + pdf_document_id on hr_contract

ALTER TYPE "DocLinkType" ADD VALUE IF NOT EXISTS 'HR_CONTRACT';

ALTER TABLE "hr_contract" ADD COLUMN IF NOT EXISTS "pdf_document_id" UUID;

CREATE INDEX IF NOT EXISTS "hr_contract_company_id_pdf_document_id_idx" ON "hr_contract"("company_id", "pdf_document_id");
