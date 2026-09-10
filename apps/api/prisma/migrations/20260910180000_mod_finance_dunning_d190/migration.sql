-- Finance dunning drafts V0 (D190) — human-gated mailto / wa.me; no auto-send.

CREATE TYPE "FinDunningStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');
CREATE TYPE "FinDunningChannel" AS ENUM ('EMAIL', 'WHATSAPP');

CREATE TABLE "fin_dunning_draft" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "open_item_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "channel" "FinDunningChannel" NOT NULL,
    "milestone_day" INTEGER NOT NULL,
    "days_past_due" INTEGER NOT NULL,
    "amount_open" DECIMAL(18,3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" "FinDunningStatus" NOT NULL DEFAULT 'DRAFT',
    "confirmed_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "fin_dunning_draft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fin_dunning_draft_company_id_number_key" ON "fin_dunning_draft"("company_id", "number");
CREATE UNIQUE INDEX "fin_dunning_draft_company_id_open_item_id_milestone_day_channel_key" ON "fin_dunning_draft"("company_id", "open_item_id", "milestone_day", "channel");
CREATE INDEX "fin_dunning_draft_company_id_status_created_at_idx" ON "fin_dunning_draft"("company_id", "status", "created_at" DESC);
CREATE INDEX "fin_dunning_draft_company_id_open_item_id_idx" ON "fin_dunning_draft"("company_id", "open_item_id");
CREATE INDEX "fin_dunning_draft_company_id_customer_id_idx" ON "fin_dunning_draft"("company_id", "customer_id");

ALTER TABLE "fin_dunning_draft" ADD CONSTRAINT "fin_dunning_draft_open_item_id_fkey" FOREIGN KEY ("open_item_id") REFERENCES "fin_open_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
