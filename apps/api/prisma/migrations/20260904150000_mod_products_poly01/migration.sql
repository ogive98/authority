-- POLY-01: industry packs + md_ref_value + product type/storage as keys

CREATE TYPE "MdRefKind" AS ENUM ('product_type', 'uom', 'storage_class', 'allergen');

CREATE TABLE "md_ref_value" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "kind" "MdRefKind" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "meta_json" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "md_ref_value_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "md_ref_value_company_id_kind_code_key" ON "md_ref_value"("company_id", "kind", "code");
CREATE INDEX "md_ref_value_company_id_kind_enabled_idx" ON "md_ref_value"("company_id", "kind", "enabled");

CREATE TABLE "sa_industry_pack" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sa_industry_pack_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sa_industry_pack_key_key" ON "sa_industry_pack"("key");

CREATE TABLE "sa_industry_pack_item" (
    "id" UUID NOT NULL,
    "pack_id" UUID NOT NULL,
    "kind" "MdRefKind" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "meta_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sa_industry_pack_item_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sa_industry_pack_item_pack_id_kind_code_key" ON "sa_industry_pack_item"("pack_id", "kind", "code");
CREATE INDEX "sa_industry_pack_item_pack_id_kind_idx" ON "sa_industry_pack_item"("pack_id", "kind");

ALTER TABLE "sa_industry_pack_item" ADD CONSTRAINT "sa_industry_pack_item_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "sa_industry_pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate prd_product enums → text keys
ALTER TABLE "prd_product" ADD COLUMN "type_key" TEXT;
ALTER TABLE "prd_product" ADD COLUMN "storage_class_key" TEXT;

UPDATE "prd_product" SET "type_key" = "type"::text WHERE "type_key" IS NULL;
UPDATE "prd_product" SET "storage_class_key" = "storage_class"::text WHERE "storage_class_key" IS NULL;

ALTER TABLE "prd_product" ALTER COLUMN "type_key" SET NOT NULL;
ALTER TABLE "prd_product" ALTER COLUMN "storage_class_key" SET NOT NULL;

ALTER TABLE "prd_product" DROP COLUMN "type";
ALTER TABLE "prd_product" DROP COLUMN "storage_class";

DROP TYPE "PrdProductType";
DROP TYPE "PrdStorageClass";
