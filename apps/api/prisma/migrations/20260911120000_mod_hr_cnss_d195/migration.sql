-- D195: CNSS wage base + period snapshot (rates from Prefs only)
ALTER TABLE "hr_contract" ADD COLUMN IF NOT EXISTS "wage_base" DECIMAL(18,3);

CREATE TABLE IF NOT EXISTS "hr_cnss_snapshot" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "period_ym" TEXT NOT NULL,
  "employee_id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "wage_base" DECIMAL(18,3) NOT NULL,
  "assiette" DECIMAL(18,3) NOT NULL,
  "ceiling_applied" BOOLEAN NOT NULL DEFAULT false,
  "ceiling_amount" DECIMAL(18,3),
  "employee_rate_bps" INTEGER,
  "employer_rate_bps" INTEGER,
  "employee_amount" DECIMAL(18,3),
  "employer_amount" DECIMAL(18,3),
  "employee_law_ref" TEXT,
  "employer_law_ref" TEXT,
  "ceiling_law_ref" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'TND',
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "hr_cnss_snapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "hr_cnss_snapshot_company_id_period_ym_contract_id_key"
  ON "hr_cnss_snapshot" ("company_id", "period_ym", "contract_id");

CREATE INDEX IF NOT EXISTS "hr_cnss_snapshot_company_id_period_ym_idx"
  ON "hr_cnss_snapshot" ("company_id", "period_ym");

CREATE INDEX IF NOT EXISTS "hr_cnss_snapshot_company_id_employee_id_idx"
  ON "hr_cnss_snapshot" ("company_id", "employee_id");

ALTER TABLE "hr_cnss_snapshot"
  ADD CONSTRAINT "hr_cnss_snapshot_contract_id_fkey"
  FOREIGN KEY ("contract_id") REFERENCES "hr_contract"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hr_cnss_snapshot"
  ADD CONSTRAINT "hr_cnss_snapshot_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "hr_employee"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
