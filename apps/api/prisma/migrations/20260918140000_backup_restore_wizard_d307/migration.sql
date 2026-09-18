-- D307 Restore wizard — live apply fields + statuses
ALTER TYPE "BckRestoreStatus" ADD VALUE 'APPLYING';
ALTER TYPE "BckRestoreStatus" ADD VALUE 'APPLIED';
ALTER TYPE "BckRestoreStatus" ADD VALUE 'HEALTH_FAILED';

ALTER TABLE "bck_restore_request"
  ADD COLUMN IF NOT EXISTS "applied_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "safety_backup_id" UUID,
  ADD COLUMN IF NOT EXISTS "health_report_json" JSONB;
