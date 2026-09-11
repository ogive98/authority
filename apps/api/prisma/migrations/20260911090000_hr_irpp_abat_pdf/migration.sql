-- D202 — IRPP family abatements + bulletin PDF document link

ALTER TYPE "DocLinkType" ADD VALUE IF NOT EXISTS 'HR_BULLETIN';

ALTER TABLE "hr_employee"
  ADD COLUMN IF NOT EXISTS "tax_chef_de_famille" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "tax_enfant_count" INTEGER;

ALTER TABLE "hr_irpp_snapshot"
  ADD COLUMN IF NOT EXISTS "annual_taxable_before_abat" DECIMAL(18,3),
  ADD COLUMN IF NOT EXISTS "tax_chef_de_famille" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "tax_enfant_count" INTEGER,
  ADD COLUMN IF NOT EXISTS "abat_chef_annual" DECIMAL(18,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "abat_enfant_annual" DECIMAL(18,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "abat_total_annual" DECIMAL(18,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "abat_chef_law_ref" TEXT,
  ADD COLUMN IF NOT EXISTS "abat_enfant_law_ref" TEXT;

-- Backfill pre-abatement annual = existing annual_taxable (no abatement applied historically)
UPDATE "hr_irpp_snapshot"
SET "annual_taxable_before_abat" = "annual_taxable"
WHERE "annual_taxable_before_abat" IS NULL;

ALTER TABLE "hr_irpp_snapshot"
  ALTER COLUMN "annual_taxable_before_abat" SET NOT NULL;

ALTER TABLE "hr_bulletin"
  ADD COLUMN IF NOT EXISTS "pdf_document_id" UUID;
