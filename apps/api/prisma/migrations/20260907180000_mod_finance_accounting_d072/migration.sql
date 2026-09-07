-- Finance AR deepen + Accounting GL V0 (D072)

CREATE TYPE "FinInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');
CREATE TYPE "FinPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'BILL_OF_EXCHANGE', 'OTHER');
CREATE TYPE "FinPaymentStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');
CREATE TYPE "FinAllocationPolicy" AS ENUM ('OLDEST_FIRST', 'NEWEST_FIRST', 'PROPORTIONAL', 'COMPLETION_FIRST', 'LARGEST_FIRST', 'OVERDUE_FIRST', 'MANUAL');
CREATE TYPE "FinInstrumentType" AS ENUM ('CHEQUE', 'BILL_OF_EXCHANGE');
CREATE TYPE "FinInstrumentStatus" AS ENUM ('RECEIVED', 'DEPOSITED', 'PRESENTED', 'CLEARED', 'REJECTED', 'CANCELLED');
CREATE TYPE "AccAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
CREATE TYPE "AccPeriodStatus" AS ENUM ('OPEN', 'SOFT_CLOSED', 'CLOSED', 'LOCKED');
CREATE TYPE "AccEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

CREATE TABLE "fin_invoice" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "status" "FinInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "sales_order_id" UUID,
    "shipment_id" UUID,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "amount_total" DECIMAL(18,3) NOT NULL,
    "due_date" DATE,
    "issued_at" TIMESTAMPTZ(6),
    "label" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "fin_invoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fin_invoice_company_id_number_key" ON "fin_invoice"("company_id", "number");
CREATE INDEX "fin_invoice_company_id_created_at_idx" ON "fin_invoice"("company_id", "created_at" DESC);
CREATE INDEX "fin_invoice_company_id_customer_id_status_idx" ON "fin_invoice"("company_id", "customer_id", "status");
CREATE INDEX "fin_invoice_company_id_sales_order_id_idx" ON "fin_invoice"("company_id", "sales_order_id");

ALTER TABLE "fin_open_item" ADD COLUMN "invoice_id" UUID;
CREATE INDEX "fin_open_item_company_id_invoice_id_idx" ON "fin_open_item"("company_id", "invoice_id");
ALTER TABLE "fin_open_item" ADD CONSTRAINT "fin_open_item_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "fin_invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "fin_payment" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "amount" DECIMAL(18,3) NOT NULL,
    "amount_unallocated" DECIMAL(18,3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "method" "FinPaymentMethod" NOT NULL DEFAULT 'OTHER',
    "status" "FinPaymentStatus" NOT NULL DEFAULT 'POSTED',
    "payment_date" DATE NOT NULL,
    "accounting_date" DATE NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "fin_payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fin_payment_company_id_number_key" ON "fin_payment"("company_id", "number");
CREATE INDEX "fin_payment_company_id_customer_id_payment_date_idx" ON "fin_payment"("company_id", "customer_id", "payment_date" DESC);
CREATE INDEX "fin_payment_company_id_status_idx" ON "fin_payment"("company_id", "status");

ALTER TABLE "fin_allocation" ADD COLUMN "payment_id" UUID;
CREATE INDEX "fin_allocation_company_id_payment_id_idx" ON "fin_allocation"("company_id", "payment_id");
ALTER TABLE "fin_allocation" ADD CONSTRAINT "fin_allocation_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "fin_payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "fin_payment_instrument" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "type" "FinInstrumentType" NOT NULL,
    "status" "FinInstrumentStatus" NOT NULL DEFAULT 'RECEIVED',
    "number" TEXT NOT NULL,
    "bank_name" TEXT,
    "holder" TEXT,
    "amount" DECIMAL(18,3) NOT NULL,
    "issue_date" DATE,
    "receive_date" DATE,
    "due_date" DATE,
    "deposit_date" DATE,
    "cleared_at" TIMESTAMPTZ(6),
    "rejected_at" TIMESTAMPTZ(6),
    "reject_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "fin_payment_instrument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fin_payment_instrument_company_id_payment_id_idx" ON "fin_payment_instrument"("company_id", "payment_id");
CREATE INDEX "fin_payment_instrument_company_id_status_due_date_idx" ON "fin_payment_instrument"("company_id", "status", "due_date");
ALTER TABLE "fin_payment_instrument" ADD CONSTRAINT "fin_payment_instrument_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "fin_payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "acc_fiscal_year" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "acc_fiscal_year_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "acc_fiscal_year_company_id_code_key" ON "acc_fiscal_year"("company_id", "code");

CREATE TABLE "acc_fiscal_period" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "fiscal_year_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "AccPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "acc_fiscal_period_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "acc_fiscal_period_company_id_code_key" ON "acc_fiscal_period"("company_id", "code");
CREATE INDEX "acc_fiscal_period_company_id_status_idx" ON "acc_fiscal_period"("company_id", "status");
ALTER TABLE "acc_fiscal_period" ADD CONSTRAINT "acc_fiscal_period_fiscal_year_id_fkey" FOREIGN KEY ("fiscal_year_id") REFERENCES "acc_fiscal_year"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "acc_account" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccAccountType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "acc_account_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "acc_account_company_id_code_key" ON "acc_account"("company_id", "code");
CREATE INDEX "acc_account_company_id_type_idx" ON "acc_account"("company_id", "type");

CREATE TABLE "acc_journal" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "acc_journal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "acc_journal_company_id_code_key" ON "acc_journal"("company_id", "code");

CREATE TABLE "acc_journal_entry" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "journal_id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "status" "AccEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "entry_date" DATE NOT NULL,
    "description" TEXT,
    "source_type" TEXT,
    "source_id" UUID,
    "posted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "acc_journal_entry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "acc_journal_entry_company_id_number_key" ON "acc_journal_entry"("company_id", "number");
CREATE INDEX "acc_journal_entry_company_id_period_id_status_idx" ON "acc_journal_entry"("company_id", "period_id", "status");
CREATE INDEX "acc_journal_entry_company_id_journal_id_idx" ON "acc_journal_entry"("company_id", "journal_id");
ALTER TABLE "acc_journal_entry" ADD CONSTRAINT "acc_journal_entry_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "acc_journal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "acc_journal_entry" ADD CONSTRAINT "acc_journal_entry_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "acc_fiscal_period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "acc_journal_line" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "debit" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "memo" TEXT,
    "line_no" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "acc_journal_line_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "acc_journal_line_company_id_entry_id_idx" ON "acc_journal_line"("company_id", "entry_id");
CREATE INDEX "acc_journal_line_company_id_account_id_idx" ON "acc_journal_line"("company_id", "account_id");
ALTER TABLE "acc_journal_line" ADD CONSTRAINT "acc_journal_line_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "acc_journal_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "acc_journal_line" ADD CONSTRAINT "acc_journal_line_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "acc_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
