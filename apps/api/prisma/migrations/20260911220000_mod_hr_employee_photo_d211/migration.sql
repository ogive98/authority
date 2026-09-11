-- D211 — employee portrait points at an existing Documents HR_EMPLOYEE file

ALTER TABLE "hr_employee" ADD COLUMN "photo_document_id" UUID;

CREATE INDEX "hr_employee_company_id_photo_document_id_idx" ON "hr_employee"("company_id", "photo_document_id");

ALTER TABLE "hr_employee" ADD CONSTRAINT "hr_employee_photo_document_id_fkey" FOREIGN KEY ("photo_document_id") REFERENCES "doc_document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
