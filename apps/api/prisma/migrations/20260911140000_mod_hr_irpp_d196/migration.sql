-- D196: IRPP annual brackets table + period snapshots (never seed rates).

CREATE TABLE "hr_irpp_bracket" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "up_to_milli" INTEGER,
    "rate_bps" INTEGER NOT NULL,
    "law_ref" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hr_irpp_bracket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hr_irpp_bracket_company_id_sort_order_idx" ON "hr_irpp_bracket"("company_id", "sort_order");

CREATE TABLE "hr_irpp_snapshot" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "period_ym" TEXT NOT NULL,
    "employee_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "wage_base" DECIMAL(18,3) NOT NULL,
    "cnss_employee_amount" DECIMAL(18,3) NOT NULL,
    "taxable_monthly" DECIMAL(18,3) NOT NULL,
    "annual_taxable" DECIMAL(18,3) NOT NULL,
    "annual_irpp" DECIMAL(18,3) NOT NULL,
    "monthly_irpp" DECIMAL(18,3) NOT NULL,
    "brackets_json" JSONB NOT NULL,
    "irpp_law_ref" TEXT,
    "method_note" TEXT NOT NULL DEFAULT 'annual_brackets_div_12',
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hr_irpp_snapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hr_irpp_snapshot_company_id_period_ym_contract_id_key" ON "hr_irpp_snapshot"("company_id", "period_ym", "contract_id");
CREATE INDEX "hr_irpp_snapshot_company_id_period_ym_idx" ON "hr_irpp_snapshot"("company_id", "period_ym");
CREATE INDEX "hr_irpp_snapshot_company_id_employee_id_idx" ON "hr_irpp_snapshot"("company_id", "employee_id");

ALTER TABLE "hr_irpp_snapshot" ADD CONSTRAINT "hr_irpp_snapshot_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "hr_contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_irpp_snapshot" ADD CONSTRAINT "hr_irpp_snapshot_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
