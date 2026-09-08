-- FODEC / timbre on invoices when Préférences expertise VALIDATED (D093)

ALTER TABLE "fin_invoice" ADD COLUMN "amount_fodec" DECIMAL(18,3) NOT NULL DEFAULT 0;
ALTER TABLE "fin_invoice" ADD COLUMN "amount_timbre" DECIMAL(18,3) NOT NULL DEFAULT 0;
