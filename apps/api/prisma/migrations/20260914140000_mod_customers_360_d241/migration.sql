-- D241 Customer 360 model deepen
-- Lifecycle status + addresses + contact flags + credit toggles

ALTER TYPE "CusCustomerStatus" ADD VALUE IF NOT EXISTS 'PROSPECT';
ALTER TYPE "CusCustomerStatus" ADD VALUE IF NOT EXISTS 'ON_HOLD';
ALTER TYPE "CusCustomerStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

DO $$ BEGIN
  CREATE TYPE "CusAddressType" AS ENUM ('HQ', 'BILLING', 'SHIPPING', 'WAREHOUSE', 'STORE', 'POS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CusCreditStatus" AS ENUM ('NORMAL', 'WATCH', 'RISK', 'BLOCKED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "cus_customer"
  ADD COLUMN IF NOT EXISTS "enable_credit_control" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "alert_before_credit_limit" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "block_on_credit_limit" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "allow_exceptional_override" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "block_on_critical_overdue" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "notify_responsible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "credit_status" "CusCreditStatus" NOT NULL DEFAULT 'NORMAL';

CREATE TABLE IF NOT EXISTS "cus_address" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "type" "CusAddressType" NOT NULL DEFAULT 'SHIPPING',
  "label" TEXT,
  "line1" TEXT NOT NULL,
  "line2" TEXT,
  "city" TEXT,
  "governorate" TEXT,
  "postal_code" TEXT,
  "lat" DECIMAL(10,7),
  "lng" DECIMAL(10,7),
  "zone_hint" TEXT,
  "instructions" TEXT,
  "hours" TEXT,
  "contact_name" TEXT,
  "contact_phone" TEXT,
  "route_hint" TEXT,
  "habitual_driver" TEXT,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "cus_address_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cus_address_company_id_customer_id_type_idx"
  ON "cus_address"("company_id", "customer_id", "type");
CREATE INDEX IF NOT EXISTS "cus_address_company_id_customer_id_is_primary_idx"
  ON "cus_address"("company_id", "customer_id", "is_primary");

DO $$ BEGIN
  ALTER TABLE "cus_address"
    ADD CONSTRAINT "cus_address_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "cus_customer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "cus_contact"
  ADD COLUMN IF NOT EXISTS "language" VARCHAR(8),
  ADD COLUMN IF NOT EXISTS "is_primary" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "can_order" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "receive_invoices" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "receive_delivery_notes" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "receive_notifications" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "receive_dunning" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "portal_access" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "cus_contact_company_id_customer_id_is_primary_idx"
  ON "cus_contact"("company_id", "customer_id", "is_primary");
