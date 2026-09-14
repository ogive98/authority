-- D243 Portal payment declaration (human-gated, no FinPayment auto-create)

DO $$ BEGIN
  CREATE TYPE "PtlPaymentDeclarationStatus" AS ENUM (
    'SUBMITTED',
    'ACKNOWLEDGED',
    'REJECTED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ptl_payment_declaration" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "number" TEXT NOT NULL,
  "amount" DECIMAL(18,3) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'TND',
  "method" "FinPaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
  "payment_date" DATE NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "open_item_id" UUID,
  "status" "PtlPaymentDeclarationStatus" NOT NULL DEFAULT 'SUBMITTED',
  "created_by_user_id" UUID NOT NULL,
  "reviewed_at" TIMESTAMPTZ(6),
  "reviewed_by_user_id" UUID,
  "review_note" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "ptl_payment_declaration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ptl_payment_declaration_company_id_number_key"
  ON "ptl_payment_declaration"("company_id", "number");
CREATE INDEX IF NOT EXISTS "ptl_payment_declaration_company_id_customer_id_created_at_idx"
  ON "ptl_payment_declaration"("company_id", "customer_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "ptl_payment_declaration_company_id_status_created_at_idx"
  ON "ptl_payment_declaration"("company_id", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "ptl_payment_declaration_company_id_open_item_id_idx"
  ON "ptl_payment_declaration"("company_id", "open_item_id");
