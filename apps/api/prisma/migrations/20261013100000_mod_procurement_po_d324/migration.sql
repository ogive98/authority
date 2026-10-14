-- CreateEnum
CREATE TYPE "ProcSuggestionReason" AS ENUM ('MIN', 'SAFETY', 'FORECAST', 'MANUAL');

-- CreateEnum
CREATE TYPE "ProcSuggestionStatus" AS ENUM ('OPEN', 'APPROVED', 'REJECTED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "ProcPoStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'SENT', 'CONFIRMED', 'PARTIAL', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProcPoLineStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProcReceiptKind" AS ENUM ('RECEIPT', 'RETURN');

-- CreateEnum
CREATE TYPE "ProcReceiptStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateEnum
CREATE TYPE "ProcMessageChannel" AS ENUM ('WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "ProcMessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "proc_suggestion" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "product_id" UUID NOT NULL,
    "site_id" UUID,
    "qty" DECIMAL(18,3) NOT NULL,
    "reason" "ProcSuggestionReason" NOT NULL,
    "status" "ProcSuggestionStatus" NOT NULL DEFAULT 'OPEN',
    "po_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "proc_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proc_po" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "supplier_id" UUID NOT NULL,
    "site_id" UUID,
    "warehouse_id" UUID,
    "status" "ProcPoStatus" NOT NULL DEFAULT 'DRAFT',
    "expected_date" DATE,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "notes" TEXT,
    "amount_total" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "confirmed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "proc_po_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proc_po_line" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "po_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "qty_ordered" DECIMAL(18,3) NOT NULL,
    "qty_received" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(18,3) NOT NULL,
    "line_total" DECIMAL(18,3) NOT NULL,
    "moq" DECIMAL(18,3),
    "pack" DECIMAL(18,3),
    "status" "ProcPoLineStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "proc_po_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proc_receipt" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "po_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "kind" "ProcReceiptKind" NOT NULL DEFAULT 'RECEIPT',
    "status" "ProcReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "qc_status" TEXT,
    "posted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "proc_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proc_receipt_line" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "po_line_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "lot_code" TEXT,
    "dlc" DATE,
    "unit_price" DECIMAL(18,3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "proc_receipt_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proc_message_log" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "po_id" UUID NOT NULL,
    "channel" "ProcMessageChannel" NOT NULL,
    "to_address" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "body_preview" TEXT,
    "status" "ProcMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "external_ref" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "error" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "proc_message_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proc_suggestion_company_id_created_at_idx" ON "proc_suggestion"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "proc_suggestion_company_id_status_idx" ON "proc_suggestion"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "proc_suggestion_company_id_number_key" ON "proc_suggestion"("company_id", "number");

-- CreateIndex
CREATE INDEX "proc_po_company_id_created_at_idx" ON "proc_po"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "proc_po_company_id_status_idx" ON "proc_po"("company_id", "status");

-- CreateIndex
CREATE INDEX "proc_po_company_id_supplier_id_idx" ON "proc_po"("company_id", "supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "proc_po_company_id_number_key" ON "proc_po"("company_id", "number");

-- CreateIndex
CREATE INDEX "proc_po_line_company_id_po_id_idx" ON "proc_po_line"("company_id", "po_id");

-- CreateIndex
CREATE UNIQUE INDEX "proc_po_line_po_id_line_no_key" ON "proc_po_line"("po_id", "line_no");

-- CreateIndex
CREATE INDEX "proc_receipt_company_id_created_at_idx" ON "proc_receipt"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "proc_receipt_company_id_po_id_idx" ON "proc_receipt"("company_id", "po_id");

-- CreateIndex
CREATE UNIQUE INDEX "proc_receipt_company_id_number_key" ON "proc_receipt"("company_id", "number");

-- CreateIndex
CREATE INDEX "proc_receipt_line_company_id_receipt_id_idx" ON "proc_receipt_line"("company_id", "receipt_id");

-- CreateIndex
CREATE UNIQUE INDEX "proc_receipt_line_receipt_id_line_no_key" ON "proc_receipt_line"("receipt_id", "line_no");

-- CreateIndex
CREATE INDEX "proc_message_log_company_id_created_at_idx" ON "proc_message_log"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "proc_message_log_company_id_po_id_idx" ON "proc_message_log"("company_id", "po_id");

-- AddForeignKey
ALTER TABLE "proc_po_line" ADD CONSTRAINT "proc_po_line_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "proc_po"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proc_receipt_line" ADD CONSTRAINT "proc_receipt_line_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "proc_receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

