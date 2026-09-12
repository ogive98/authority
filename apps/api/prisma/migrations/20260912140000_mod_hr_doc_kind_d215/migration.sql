-- D215 — HR dossier kind catalogue + optional FK on doc_document (never seed)

CREATE TABLE "hr_doc_kind" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hr_doc_kind_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hr_doc_kind_company_id_code_key" ON "hr_doc_kind"("company_id", "code");
CREATE INDEX "hr_doc_kind_company_id_active_idx" ON "hr_doc_kind"("company_id", "active");
CREATE INDEX "hr_doc_kind_company_id_created_at_idx" ON "hr_doc_kind"("company_id", "created_at" DESC);

ALTER TABLE "doc_document" ADD COLUMN "hr_doc_kind_id" UUID;

CREATE INDEX "doc_document_company_id_hr_doc_kind_id_idx" ON "doc_document"("company_id", "hr_doc_kind_id");

ALTER TABLE "doc_document" ADD CONSTRAINT "doc_document_hr_doc_kind_id_fkey" FOREIGN KEY ("hr_doc_kind_id") REFERENCES "hr_doc_kind"("id") ON DELETE SET NULL ON UPDATE CASCADE;
