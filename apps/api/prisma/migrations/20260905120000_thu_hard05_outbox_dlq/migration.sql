-- THU-HARD-05: dead-letter queue for exhausted outbox publishes

CREATE TABLE "core_outbox_dlq" (
    "id" UUID NOT NULL,
    "outbox_id" UUID NOT NULL,
    "company_id" UUID,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_version" INTEGER NOT NULL,
    "payload_json" JSONB NOT NULL,
    "headers" JSONB,
    "last_error" TEXT NOT NULL,
    "publish_attempts" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "failed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "core_outbox_dlq_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "core_outbox_dlq_company_id_failed_at_idx" ON "core_outbox_dlq"("company_id", "failed_at" DESC);
CREATE INDEX "core_outbox_dlq_outbox_id_idx" ON "core_outbox_dlq"("outbox_id");
CREATE INDEX "core_outbox_dlq_event_type_idx" ON "core_outbox_dlq"("event_type");
