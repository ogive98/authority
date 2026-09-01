-- CreateEnum
CREATE TYPE "IamGrantEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "IamGrantSubject" AS ENUM ('USER', 'ROLE');

-- CreateTable
CREATE TABLE "iam_grant" (
    "id" UUID NOT NULL,
    "permission_key" TEXT NOT NULL,
    "effect" "IamGrantEffect" NOT NULL DEFAULT 'ALLOW',
    "subject_type" "IamGrantSubject" NOT NULL,
    "subject_id" TEXT NOT NULL,
    "company_id" UUID,
    "site_id" UUID,
    "warehouse_id" UUID,
    "status" "IamLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "iam_grant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "iam_grant_subject_type_subject_id_permission_key_idx" ON "iam_grant"("subject_type", "subject_id", "permission_key");
CREATE INDEX "iam_grant_company_id_permission_key_idx" ON "iam_grant"("company_id", "permission_key");
