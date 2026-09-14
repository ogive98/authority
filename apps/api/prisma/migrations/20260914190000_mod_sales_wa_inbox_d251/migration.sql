-- D251 — WhatsApp inbound inbox (human-gated → sales draft)

CREATE TYPE "WaInboundStatus" AS ENUM ('OPEN', 'MATCHED', 'DRAFT_CREATED', 'DISMISSED');

CREATE TABLE "wa_inbound_message" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "wamid" TEXT NOT NULL,
    "from_phone" TEXT NOT NULL,
    "profile_name" TEXT,
    "body_text" TEXT,
    "message_type" TEXT NOT NULL DEFAULT 'text',
    "contact_id" UUID,
    "customer_id" UUID,
    "status" "WaInboundStatus" NOT NULL DEFAULT 'OPEN',
    "order_id" UUID,
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "wa_inbound_message_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wa_inbound_message_company_id_wamid_key" ON "wa_inbound_message"("company_id", "wamid");
CREATE INDEX "wa_inbound_message_company_id_status_received_at_idx" ON "wa_inbound_message"("company_id", "status", "received_at" DESC);
CREATE INDEX "wa_inbound_message_company_id_from_phone_idx" ON "wa_inbound_message"("company_id", "from_phone");
CREATE INDEX "wa_inbound_message_company_id_customer_id_idx" ON "wa_inbound_message"("company_id", "customer_id");
