-- D209 — company job-title catalog + Documents link HR_EMPLOYEE

ALTER TYPE "DocLinkType" ADD VALUE IF NOT EXISTS 'HR_EMPLOYEE';

CREATE TABLE "hr_job_title" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hr_job_title_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hr_job_title_company_id_code_key" ON "hr_job_title"("company_id", "code");
CREATE INDEX "hr_job_title_company_id_active_idx" ON "hr_job_title"("company_id", "active");
CREATE INDEX "hr_job_title_company_id_created_at_idx" ON "hr_job_title"("company_id", "created_at" DESC);

ALTER TABLE "hr_employee" ADD COLUMN "job_title_id" UUID;

INSERT INTO "hr_job_title" ("id", "company_id", "code", "name", "active", "version", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    src."company_id",
    src."code",
    src."name",
    true,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT
        x."company_id",
        x."name",
        CASE
            WHEN x."base_code" = '' THEN 'JOB-' || substr(md5(x."name"), 1, 8)
            WHEN x."rn" = 1 THEN left(x."base_code", 32)
            ELSE left(x."base_code", 24) || '-' || x."rn"::text
        END AS "code"
    FROM (
        SELECT
            d."company_id",
            d."name",
            upper(left(regexp_replace(d."name", '[^A-Za-z0-9]+', '-', 'g'), 32)) AS "base_code",
            row_number() OVER (
                PARTITION BY d."company_id",
                    upper(left(regexp_replace(d."name", '[^A-Za-z0-9]+', '-', 'g'), 32))
                ORDER BY d."name"
            ) AS "rn"
        FROM (
            SELECT DISTINCT e."company_id", btrim(e."job_title") AS "name"
            FROM "hr_employee" e
            WHERE e."job_title" IS NOT NULL AND btrim(e."job_title") <> ''
        ) d
    ) x
) src;

UPDATE "hr_employee" e
SET "job_title_id" = t."id"
FROM "hr_job_title" t
WHERE e."company_id" = t."company_id"
  AND e."job_title" IS NOT NULL
  AND lower(btrim(e."job_title")) = lower(t."name");

ALTER TABLE "hr_employee" DROP COLUMN "job_title";

ALTER TABLE "hr_employee"
    ADD CONSTRAINT "hr_employee_job_title_id_fkey"
    FOREIGN KEY ("job_title_id") REFERENCES "hr_job_title"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "hr_employee_company_id_job_title_id_idx" ON "hr_employee"("company_id", "job_title_id");
