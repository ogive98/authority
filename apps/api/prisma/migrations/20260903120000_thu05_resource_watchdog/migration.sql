-- THU-05: stalled/paused job support

ALTER TYPE "ThunderJobStatus" ADD VALUE IF NOT EXISTS 'PAUSED_BY_MODULE';

ALTER TABLE "thunder_job" ADD COLUMN IF NOT EXISTS "heartbeat_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "thunder_job_status_heartbeat_at_idx"
  ON "thunder_job"("status", "heartbeat_at");
