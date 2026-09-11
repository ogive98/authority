-- D199: HR bulletin compose from CNSS + IRPP snapshots (never invent rates).

CREATE TABLE "hr_bulletin" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "period_ym" TEXT NOT NULL,
    "employee_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "wage_base" DECIMAL(18,3) NOT NULL,
    "cnss_employee_amount" DECIMAL(18,3) NOT NULL,
    "cnss_employer_amount" DECIMAL(18,3) NOT NULL,
    "irpp_monthly" DECIMAL(18,3) NOT NULL,
    "net_pay" DECIMAL(18,3) NOT NULL,
    "cnss_snapshot_id" UUID,
    "irpp_snapshot_id" UUID,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hr_bulletin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hr_bulletin_company_id_period_ym_contract_id_key" ON "hr_bulletin"("company_id", "period_ym", "contract_id");
CREATE UNIQUE INDEX "hr_bulletin_company_id_number_key" ON "hr_bulletin"("company_id", "number");
CREATE INDEX "hr_bulletin_company_id_period_ym_idx" ON "hr_bulletin"("company_id", "period_ym");
CREATE INDEX "hr_bulletin_company_id_employee_id_idx" ON "hr_bulletin"("company_id", "employee_id");

ALTER TABLE "hr_bulletin" ADD CONSTRAINT "hr_bulletin_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "hr_contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_bulletin" ADD CONSTRAINT "hr_bulletin_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
