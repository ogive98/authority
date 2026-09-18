-- D300 Configuration Plan rollback to N-1
ALTER TYPE "SetConfigPlanStatus" ADD VALUE IF NOT EXISTS 'ROLLED_BACK';

ALTER TABLE "set_config_plan"
  ADD COLUMN IF NOT EXISTS "before_patches_json" JSONB,
  ADD COLUMN IF NOT EXISTS "rolled_back_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "rolled_back_at" TIMESTAMPTZ(6);
