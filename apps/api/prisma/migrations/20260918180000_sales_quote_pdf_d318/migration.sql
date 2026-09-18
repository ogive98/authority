-- D318 — Sales quote PDF link type + optional persisted document id
ALTER TYPE "DocLinkType" ADD VALUE IF NOT EXISTS 'SAL_QUOTE';

ALTER TABLE "sal_quote"
  ADD COLUMN IF NOT EXISTS "pdf_document_id" UUID;

CREATE INDEX IF NOT EXISTS "sal_quote_company_id_pdf_document_id_idx"
  ON "sal_quote"("company_id", "pdf_document_id");
