-- D284 local RAS certificate fields on tax_withholding
ALTER TABLE "tax_withholding"
  ADD COLUMN "certificate_body" TEXT,
  ADD COLUMN "certificate_sha256" TEXT,
  ADD COLUMN "certificate_at" TIMESTAMPTZ(6);
