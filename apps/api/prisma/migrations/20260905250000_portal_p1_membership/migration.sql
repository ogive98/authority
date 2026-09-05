-- AlterEnum
ALTER TYPE "IamSessionRealm" ADD VALUE 'CUSTOMER_PORTAL';

-- CreateTable
CREATE TABLE "ptl_membership" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'buyer',
    "status" "IamLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ptl_membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ptl_membership_company_id_user_id_idx" ON "ptl_membership"("company_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ptl_membership_company_id_user_id_customer_id_key" ON "ptl_membership"("company_id", "user_id", "customer_id");

-- AddForeignKey
ALTER TABLE "ptl_membership" ADD CONSTRAINT "ptl_membership_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "cus_customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ptl_membership" ADD CONSTRAINT "ptl_membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
