-- Maintenance Soft Glass V0 (D256) — mnt_asset + mnt_wo

CREATE TYPE "MntAssetStatus" AS ENUM ('ONLINE', 'DOWN');
CREATE TYPE "MntWoStatus" AS ENUM ('OPEN', 'DONE');
CREATE TYPE "MntWoType" AS ENUM ('BREAKDOWN', 'PREVENTIVE');

CREATE TABLE "mnt_asset" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "MntAssetStatus" NOT NULL DEFAULT 'ONLINE',
    "vehicle_id" UUID,
    "next_preventive_at" DATE,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "mnt_asset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mnt_wo" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "type" "MntWoType" NOT NULL,
    "status" "MntWoStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "done_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "mnt_wo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mnt_asset_company_id_code_key" ON "mnt_asset"("company_id", "code");
CREATE INDEX "mnt_asset_company_id_created_at_idx" ON "mnt_asset"("company_id", "created_at" DESC);
CREATE INDEX "mnt_asset_company_id_status_idx" ON "mnt_asset"("company_id", "status");
CREATE INDEX "mnt_asset_company_id_next_preventive_at_idx" ON "mnt_asset"("company_id", "next_preventive_at");
CREATE INDEX "mnt_asset_company_id_vehicle_id_idx" ON "mnt_asset"("company_id", "vehicle_id");

CREATE INDEX "mnt_wo_company_id_created_at_idx" ON "mnt_wo"("company_id", "created_at" DESC);
CREATE INDEX "mnt_wo_company_id_status_idx" ON "mnt_wo"("company_id", "status");
CREATE INDEX "mnt_wo_company_id_asset_id_idx" ON "mnt_wo"("company_id", "asset_id");

ALTER TABLE "mnt_asset" ADD CONSTRAINT "mnt_asset_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "flt_vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mnt_wo" ADD CONSTRAINT "mnt_wo_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "mnt_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
