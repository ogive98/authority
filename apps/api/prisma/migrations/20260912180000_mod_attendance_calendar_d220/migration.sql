-- D220 attendance calendar — RH events (penalties), no payroll amounts
CREATE TYPE "AttRhEventKind" AS ENUM ('PENALTY');

CREATE TABLE "att_rh_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "kind" "AttRhEventKind" NOT NULL DEFAULT 'PENALTY',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "motif" TEXT NOT NULL,
    "notes" TEXT,
    "created_by_user_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "att_rh_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "att_rh_event_company_id_employee_id_idx" ON "att_rh_event"("company_id", "employee_id");
CREATE INDEX "att_rh_event_company_id_kind_idx" ON "att_rh_event"("company_id", "kind");
CREATE INDEX "att_rh_event_company_id_start_date_idx" ON "att_rh_event"("company_id", "start_date");

ALTER TABLE "att_rh_event" ADD CONSTRAINT "att_rh_event_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
