-- D102 product shelf life for salubrité certificate
ALTER TABLE "prd_product" ADD COLUMN "shelf_life_days" INTEGER;

-- Backfill from inventory cheese articles when present
UPDATE "prd_product" p
SET "shelf_life_days" = a."shelf_life_days"
FROM "inv_cheese_article" a
WHERE a."product_id" = p."id"
  AND a."company_id" = p."company_id"
  AND a."active" = true
  AND p."shelf_life_days" IS NULL;
