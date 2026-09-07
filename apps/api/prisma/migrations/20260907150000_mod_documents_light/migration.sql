-- Documents light V0 (D068)

CREATE TYPE "DocVisibility" AS ENUM ('INTERNAL', 'CUSTOMER_PORTAL');
CREATE TYPE "DocLinkType" AS ENUM ('NONE', 'CLAIM', 'ORDER', 'SHIPMENT');

CREATE TABLE "doc_document" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "core_file_id" UUID NOT NULL,
    "visibility" "DocVisibility" NOT NULL DEFAULT 'INTERNAL',
    "link_type" "DocLinkType" NOT NULL DEFAULT 'NONE',
    "link_id" UUID,
    "customer_id" UUID,
    "created_by_user_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "doc_document_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "doc_document_company_id_number_key" ON "doc_document"("company_id", "number");
CREATE INDEX "doc_document_company_id_created_at_idx" ON "doc_document"("company_id", "created_at" DESC);
CREATE INDEX "doc_document_company_id_customer_id_visibility_idx" ON "doc_document"("company_id", "customer_id", "visibility");
CREATE INDEX "doc_document_company_id_link_type_link_id_idx" ON "doc_document"("company_id", "link_type", "link_id");
