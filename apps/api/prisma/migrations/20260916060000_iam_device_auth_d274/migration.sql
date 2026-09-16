-- D274 AUTHORITY X device pairing (token hash only — never store plaintext).

ALTER TABLE "iam_device" ADD COLUMN IF NOT EXISTS "company_id" UUID;
ALTER TABLE "iam_device" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'AUTHORITY_X';
ALTER TABLE "iam_device" ADD COLUMN IF NOT EXISTS "token_hash" TEXT;
ALTER TABLE "iam_device" ADD COLUMN IF NOT EXISTS "pair_code_hash" TEXT;
ALTER TABLE "iam_device" ADD COLUMN IF NOT EXISTS "pair_expires_at" TIMESTAMPTZ(6);
ALTER TABLE "iam_device" ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMPTZ(6);
ALTER TABLE "iam_device" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ(6);
ALTER TABLE "iam_device" ADD COLUMN IF NOT EXISTS "status" "IamLifecycleStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "iam_device" ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMPTZ(6);

DELETE FROM "iam_device" WHERE "company_id" IS NULL;

ALTER TABLE "iam_device" ALTER COLUMN "company_id" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "iam_device_token_hash_key" ON "iam_device"("token_hash");
CREATE INDEX IF NOT EXISTS "iam_device_company_id_idx" ON "iam_device"("company_id");
CREATE INDEX IF NOT EXISTS "iam_device_pair_code_hash_idx" ON "iam_device"("pair_code_hash");

ALTER TABLE "iam_device" ADD CONSTRAINT "iam_device_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "org_company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
