-- Finance credit note / avoir V0 (D192) — invoice-linked only; no stock restore.

CREATE TYPE "FinCreditNoteStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

CREATE TABLE "fin_credit_note" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "invoice_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "status" "FinCreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "amount_ht" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "amount_tax" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "amount_fodec" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "amount_timbre" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "amount_total" DECIMAL(18,3) NOT NULL,
    "amount_applied_to_ar" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "amount_unapplied" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "notes" TEXT,
    "issued_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "fin_credit_note_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fin_credit_note_line" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "credit_note_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "unit_price_ht" DECIMAL(18,3) NOT NULL,
    "tax_code_id" UUID NOT NULL,
    "amount_ht" DECIMAL(18,3) NOT NULL,
    "amount_tax" DECIMAL(18,3) NOT NULL,
    "amount_ttc" DECIMAL(18,3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "fin_credit_note_line_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fin_credit_note_company_id_number_key" ON "fin_credit_note"("company_id", "number");
CREATE INDEX "fin_credit_note_company_id_created_at_idx" ON "fin_credit_note"("company_id", "created_at" DESC);
CREATE INDEX "fin_credit_note_company_id_invoice_id_status_idx" ON "fin_credit_note"("company_id", "invoice_id", "status");
CREATE INDEX "fin_credit_note_company_id_customer_id_status_idx" ON "fin_credit_note"("company_id", "customer_id", "status");

CREATE UNIQUE INDEX "fin_credit_note_line_credit_note_id_line_no_key" ON "fin_credit_note_line"("credit_note_id", "line_no");
CREATE INDEX "fin_credit_note_line_company_id_credit_note_id_idx" ON "fin_credit_note_line"("company_id", "credit_note_id");

ALTER TABLE "fin_credit_note" ADD CONSTRAINT "fin_credit_note_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "fin_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fin_credit_note_line" ADD CONSTRAINT "fin_credit_note_line_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "fin_credit_note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fin_credit_note_line" ADD CONSTRAINT "fin_credit_note_line_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
