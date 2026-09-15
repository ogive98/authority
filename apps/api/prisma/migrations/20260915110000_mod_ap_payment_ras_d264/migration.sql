-- D264 RAS AP auto-deduct on FinApPayment when tax.ras Prefs VALIDATED.
-- amount = net disbursed; amount_ras = withheld; rate snapshot for audit.

ALTER TABLE "fin_ap_payment"
  ADD COLUMN "amount_ras" DECIMAL(18,3) NOT NULL DEFAULT 0,
  ADD COLUMN "ras_rate_bps" INTEGER,
  ADD COLUMN "ras_applied" BOOLEAN NOT NULL DEFAULT false;
