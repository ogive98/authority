-- D194: dunning provider send outcome (SMTP / WA Cloud)
CREATE TYPE "FinDunningSendStatus" AS ENUM ('NONE', 'SENT', 'FAILED');

ALTER TABLE "fin_dunning_draft"
  ADD COLUMN IF NOT EXISTS "send_status" "FinDunningSendStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "send_error" TEXT,
  ADD COLUMN IF NOT EXISTS "provider_message_id" TEXT;

CREATE INDEX IF NOT EXISTS "fin_dunning_draft_company_id_send_status_idx"
  ON "fin_dunning_draft" ("company_id", "send_status");
