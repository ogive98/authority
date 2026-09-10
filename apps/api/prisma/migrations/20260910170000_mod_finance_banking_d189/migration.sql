-- Finance banking / soft reconciliation V0 (D189)
-- GL remains on allocate; match is soft state only.

CREATE TYPE "FinBankLineStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'IGNORED');

CREATE TABLE "fin_bank_account" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "bank_name" TEXT,
    "rib" TEXT,
    "iban" TEXT,
    "gl_account_code" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "fin_bank_account_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fin_bank_account_company_id_code_key" ON "fin_bank_account"("company_id", "code");
CREATE INDEX "fin_bank_account_company_id_active_idx" ON "fin_bank_account"("company_id", "active");

CREATE TABLE "fin_bank_statement_line" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "line_date" DATE NOT NULL,
    "amount" DECIMAL(18,3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "reference" TEXT,
    "counterparty" TEXT,
    "memo" TEXT,
    "status" "FinBankLineStatus" NOT NULL DEFAULT 'UNMATCHED',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "fin_bank_statement_line_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fin_bank_statement_line_company_id_bank_account_id_line_date_idx" ON "fin_bank_statement_line"("company_id", "bank_account_id", "line_date" DESC);
CREATE INDEX "fin_bank_statement_line_company_id_status_idx" ON "fin_bank_statement_line"("company_id", "status");

ALTER TABLE "fin_bank_statement_line" ADD CONSTRAINT "fin_bank_statement_line_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "fin_bank_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "fin_bank_match" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "statement_line_id" UUID NOT NULL,
    "payment_id" UUID,
    "instrument_id" UUID,
    "note" TEXT,
    "matched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "fin_bank_match_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fin_bank_match_statement_line_id_key" ON "fin_bank_match"("statement_line_id");
CREATE UNIQUE INDEX "fin_bank_match_payment_id_key" ON "fin_bank_match"("payment_id");
CREATE UNIQUE INDEX "fin_bank_match_instrument_id_key" ON "fin_bank_match"("instrument_id");
CREATE INDEX "fin_bank_match_company_id_matched_at_idx" ON "fin_bank_match"("company_id", "matched_at" DESC);

ALTER TABLE "fin_bank_match" ADD CONSTRAINT "fin_bank_match_statement_line_id_fkey" FOREIGN KEY ("statement_line_id") REFERENCES "fin_bank_statement_line"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fin_bank_match" ADD CONSTRAINT "fin_bank_match_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "fin_payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fin_bank_match" ADD CONSTRAINT "fin_bank_match_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "fin_payment_instrument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
