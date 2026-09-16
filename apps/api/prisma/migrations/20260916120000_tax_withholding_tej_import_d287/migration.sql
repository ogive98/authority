-- D287 — local Tej import acknowledgment (not AUTHORITY→TEJ transmission)
ALTER TABLE "tax_withholding"
  ADD COLUMN "tej_import_ack_at" TIMESTAMPTZ(6),
  ADD COLUMN "tej_import_note" TEXT,
  ADD COLUMN "tej_reject_reason" TEXT;
