-- D214 — optional OrgSite FK on hr_employee (company-scoped établissement)

ALTER TABLE "hr_employee" ADD CONSTRAINT "hr_employee_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "org_site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "hr_employee_company_id_site_id_idx" ON "hr_employee"("company_id", "site_id");
