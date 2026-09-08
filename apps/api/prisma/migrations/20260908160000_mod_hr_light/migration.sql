-- HR light V0 (D089) — employees / contracts; no CNSS contribution rates

CREATE TYPE "HrEmployeeStatus" AS ENUM ('ACTIVE', 'LEFT');
CREATE TYPE "HrContractStatus" AS ENUM ('ACTIVE', 'ENDED');
CREATE TYPE "HrContractType" AS ENUM ('CDI', 'CDD', 'INTERIM', 'STAGE', 'OTHER');

CREATE TABLE "hr_employee" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "matricule" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "site_id" UUID,
    "department" TEXT,
    "job_title" TEXT,
    "cnss_no" TEXT,
    "email" TEXT,
    "user_id" UUID,
    "status" "HrEmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "hired_at" DATE,
    "left_at" DATE,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hr_employee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hr_employee_company_id_matricule_key" ON "hr_employee"("company_id", "matricule");
CREATE INDEX "hr_employee_company_id_status_idx" ON "hr_employee"("company_id", "status");
CREATE INDEX "hr_employee_company_id_created_at_idx" ON "hr_employee"("company_id", "created_at" DESC);

CREATE TABLE "hr_contract" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "type" "HrContractType" NOT NULL DEFAULT 'CDI',
    "status" "HrContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "wage_ref" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hr_contract_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hr_contract_company_id_number_key" ON "hr_contract"("company_id", "number");
CREATE INDEX "hr_contract_company_id_employee_id_idx" ON "hr_contract"("company_id", "employee_id");
CREATE INDEX "hr_contract_company_id_status_idx" ON "hr_contract"("company_id", "status");

ALTER TABLE "hr_contract" ADD CONSTRAINT "hr_contract_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
