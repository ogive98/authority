-- D218 — Attendance leave V0 + Employee Portal realm
-- Absence is request/approve only — never invent Tunisian leave quotas.

ALTER TYPE "IamSessionRealm" ADD VALUE IF NOT EXISTS 'EMPLOYEE_PORTAL';

CREATE TYPE "AttAbsenceType" AS ENUM ('PAID', 'UNPAID', 'OTHER');
CREATE TYPE "AttAbsenceStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "att_absence" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "type" "AttAbsenceType" NOT NULL,
    "status" "AttAbsenceStatus" NOT NULL DEFAULT 'REQUESTED',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "requested_by_user_id" UUID,
    "decided_by_user_id" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "att_absence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "att_absence_company_id_status_idx" ON "att_absence"("company_id", "status");
CREATE INDEX "att_absence_company_id_employee_id_idx" ON "att_absence"("company_id", "employee_id");
CREATE INDEX "att_absence_company_id_created_at_idx" ON "att_absence"("company_id", "created_at" DESC);

ALTER TABLE "att_absence"
  ADD CONSTRAINT "att_absence_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "hr_employee"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
