-- THU-01: thunder_job columns for BullMQ job abstraction

ALTER TABLE "thunder_job" ADD COLUMN "queue" TEXT NOT NULL DEFAULT 'ops';
ALTER TABLE "thunder_job" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "thunder_job" ADD COLUMN "idempotency_key" TEXT;
ALTER TABLE "thunder_job" ADD COLUMN "payload_hash" TEXT;
ALTER TABLE "thunder_job" ADD COLUMN "payload_json" JSONB;
ALTER TABLE "thunder_job" ADD COLUMN "result_json" JSONB;
ALTER TABLE "thunder_job" ADD COLUMN "error_json" JSONB;
ALTER TABLE "thunder_job" ADD COLUMN "bull_job_id" TEXT;

CREATE UNIQUE INDEX "thunder_job_company_id_idempotency_key_key"
  ON "thunder_job"("company_id", "idempotency_key");
