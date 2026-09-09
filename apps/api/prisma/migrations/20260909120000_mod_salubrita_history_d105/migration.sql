-- D105 salubrité certificate history (30 days consultable)
CREATE TABLE "inv_salubrita_certificate" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "pack_date" DATE NOT NULL,
    "warehouse_id" UUID,
    "line_count" INTEGER NOT NULL DEFAULT 0,
    "payload_json" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inv_salubrita_certificate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inv_salubrita_certificate_company_id_pack_date_key"
  ON "inv_salubrita_certificate"("company_id", "pack_date");

CREATE INDEX "inv_salubrita_certificate_company_id_pack_date_idx"
  ON "inv_salubrita_certificate"("company_id", "pack_date" DESC);
