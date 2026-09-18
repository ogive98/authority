-- D315 — Invoice PDF link type + optional persisted document id
ALTER TYPE "DocLinkType" ADD VALUE IF NOT EXISTS 'FIN_INVOICE';

ALTER TABLE "fin_invoice"
  ADD COLUMN IF NOT EXISTS "pdf_document_id" UUID;

CREATE INDEX IF NOT EXISTS "fin_invoice_company_id_pdf_document_id_idx"
  ON "fin_invoice"("company_id", "pdf_document_id");
