-- D206 WhatsApp Cloud delivery webhooks
CREATE TYPE "FinDunningWaDeliveryStatus" AS ENUM ('NONE', 'SENT', 'DELIVERED', 'READ', 'FAILED');

ALTER TABLE "fin_dunning_draft"
  ADD COLUMN "wa_delivery_status" "FinDunningWaDeliveryStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "wa_delivery_at" TIMESTAMPTZ(6),
  ADD COLUMN "wa_delivery_error" TEXT;

CREATE INDEX "fin_dunning_draft_company_id_provider_message_id_idx"
  ON "fin_dunning_draft"("company_id", "provider_message_id");
