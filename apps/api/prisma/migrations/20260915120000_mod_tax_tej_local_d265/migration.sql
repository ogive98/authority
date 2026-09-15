-- D265 Local TEJ XML draft history (hash only — no transmission).

CREATE TABLE "tax_tej_export" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "period_label" TEXT NOT NULL,
  "content_sha256" TEXT NOT NULL,
  "xml_content" TEXT NOT NULL,
  "prefs_value_label" TEXT NOT NULL,
  "law_ref" TEXT,
  "schema_note" TEXT NOT NULL,
  "transmission" TEXT NOT NULL DEFAULT 'DISABLED',
  "created_by_user_id" UUID,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "tax_tej_export_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tax_tej_export_company_id_created_at_idx" ON "tax_tej_export"("company_id", "created_at" DESC);
CREATE INDEX "tax_tej_export_company_id_content_sha256_idx" ON "tax_tej_export"("company_id", "content_sha256");
