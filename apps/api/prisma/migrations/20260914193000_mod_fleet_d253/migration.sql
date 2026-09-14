-- D253 — Fleet Soft Glass V0 (vehicles + round assignment)

CREATE TYPE "FltVehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'OUT', 'ARCHIVED');

CREATE TABLE "flt_vehicle" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "capacity_kg" DECIMAL(18,3),
    "cold" BOOLEAN NOT NULL DEFAULT false,
    "odometer_km" DECIMAL(18,3),
    "status" "FltVehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "flt_vehicle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "flt_vehicle_company_id_code_key" ON "flt_vehicle"("company_id", "code");
CREATE UNIQUE INDEX "flt_vehicle_company_id_plate_key" ON "flt_vehicle"("company_id", "plate");
CREATE INDEX "flt_vehicle_company_id_created_at_idx" ON "flt_vehicle"("company_id", "created_at" DESC);
CREATE INDEX "flt_vehicle_company_id_status_idx" ON "flt_vehicle"("company_id", "status");

CREATE TABLE "flt_assignment" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "round_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "driver_label" TEXT NOT NULL,
    "payload_kg" DECIMAL(18,3),
    "notes" TEXT,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "flt_assignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "flt_assignment_company_id_assigned_at_idx" ON "flt_assignment"("company_id", "assigned_at" DESC);
CREATE INDEX "flt_assignment_company_id_round_id_idx" ON "flt_assignment"("company_id", "round_id");
CREATE INDEX "flt_assignment_company_id_vehicle_id_idx" ON "flt_assignment"("company_id", "vehicle_id");

ALTER TABLE "flt_assignment" ADD CONSTRAINT "flt_assignment_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "dlv_round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "flt_assignment" ADD CONSTRAINT "flt_assignment_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "flt_vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
