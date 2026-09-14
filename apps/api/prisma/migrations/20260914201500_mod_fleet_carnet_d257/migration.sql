-- Fleet carnet + usual driver (D257)

CREATE TYPE "FltLogKind" AS ENUM ('ODOMETER', 'OIL_CHANGE', 'TIRES', 'FUEL', 'OTHER');

ALTER TABLE "flt_vehicle" ADD COLUMN "usual_driver_label" TEXT;
ALTER TABLE "flt_vehicle" ADD COLUMN "next_service_km" DECIMAL(18,3);
ALTER TABLE "flt_vehicle" ADD COLUMN "next_service_at" DATE;

CREATE TABLE "flt_vehicle_log" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "kind" "FltLogKind" NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "odometer_km" DECIMAL(18,3),
    "liters" DECIMAL(18,3),
    "amount_tnd" DECIMAL(18,3),
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "flt_vehicle_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "flt_vehicle_log_company_id_vehicle_id_occurred_at_idx" ON "flt_vehicle_log"("company_id", "vehicle_id", "occurred_at" DESC);
CREATE INDEX "flt_vehicle_log_company_id_created_at_idx" ON "flt_vehicle_log"("company_id", "created_at" DESC);

ALTER TABLE "flt_vehicle_log" ADD CONSTRAINT "flt_vehicle_log_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "flt_vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
