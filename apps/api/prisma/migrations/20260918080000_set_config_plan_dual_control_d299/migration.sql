-- D299 CRITICAL dual-control: second approver + intermediate status
ALTER TYPE "SetConfigPlanStatus" ADD VALUE IF NOT EXISTS 'PENDING_SECOND_APPROVAL';

ALTER TABLE "set_config_plan"
  ADD COLUMN IF NOT EXISTS "second_approved_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "second_approved_at" TIMESTAMPTZ(6);
