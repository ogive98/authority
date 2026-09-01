-- CreateEnum
CREATE TYPE "IamSessionRealm" AS ENUM ('BUSINESS', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "IamMfaPurpose" AS ENUM ('BUSINESS', 'SUPER_ADMIN');

-- AlterTable
ALTER TABLE "iam_session" ADD COLUMN "realm" "IamSessionRealm" NOT NULL DEFAULT 'BUSINESS';

-- AlterTable
ALTER TABLE "iam_mfa_device" ADD COLUMN "purpose" "IamMfaPurpose" NOT NULL DEFAULT 'BUSINESS';

-- CreateTable
CREATE TABLE "iam_super_admin_membership" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "IamLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "iam_super_admin_membership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "iam_super_admin_membership_user_id_key" ON "iam_super_admin_membership"("user_id");

CREATE INDEX "iam_session_refresh_hash_idx" ON "iam_session"("refresh_hash");

DROP INDEX IF EXISTS "iam_mfa_device_user_id_idx";
CREATE INDEX "iam_mfa_device_user_id_purpose_idx" ON "iam_mfa_device"("user_id", "purpose");

ALTER TABLE "iam_super_admin_membership" ADD CONSTRAINT "iam_super_admin_membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
