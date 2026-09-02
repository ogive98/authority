-- THU-02: dead letter queue for exhausted Thunder jobs

CREATE TABLE "thunder_dlq" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "company_id" UUID,
    "job_type" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "last_error" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thunder_dlq_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "thunder_dlq_company_id_created_at_idx" ON "thunder_dlq"("company_id", "created_at" DESC);
CREATE INDEX "thunder_dlq_job_id_idx" ON "thunder_dlq"("job_id");
