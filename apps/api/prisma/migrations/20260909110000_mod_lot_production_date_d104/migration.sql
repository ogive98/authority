-- D104 production date ≠ pack date (certificat salubrité)
ALTER TABLE "prd_product" ADD COLUMN "production_offset_days" INTEGER;
ALTER TABLE "inv_lot" ADD COLUMN "production_date" DATE;

-- Backfill: existing lots → production = pack (frais default)
UPDATE "inv_lot"
SET "production_date" = "pack_date"
WHERE "production_date" IS NULL AND "pack_date" IS NOT NULL;
