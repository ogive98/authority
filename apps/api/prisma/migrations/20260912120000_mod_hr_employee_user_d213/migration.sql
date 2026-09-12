-- D213 — optional Identity link on hr_employee (1 user = 1 employee per company)

ALTER TABLE "hr_employee" ADD CONSTRAINT "hr_employee_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "hr_employee_company_id_user_id_key" ON "hr_employee"("company_id", "user_id");
