-- D285 TEJ withholding pack linkage
ALTER TABLE "tax_tej_export"
  ADD COLUMN "pack_kind" TEXT NOT NULL DEFAULT 'META_DRAFT',
  ADD COLUMN "withholding_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "tax_withholding"
  ADD COLUMN "tej_export_id" UUID;

CREATE INDEX "tax_withholding_company_id_tej_export_id_idx"
  ON "tax_withholding"("company_id", "tej_export_id");
