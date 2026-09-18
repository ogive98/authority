-- D316 — Sales quotes (SalQuote / SalQuoteLine), separate from SalOrder.

CREATE TYPE "SalQuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'CANCELLED', 'EXPIRED');

CREATE TABLE "sal_quote" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "warehouse_id" UUID,
    "status" "SalQuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "valid_until" DATE,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "notes" TEXT,
    "amount_total" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "converted_order_id" UUID,
    "accepted_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "sal_quote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sal_quote_line" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "unit_price" DECIMAL(18,3) NOT NULL,
    "discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(18,3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sal_quote_line_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sal_quote_company_id_number_key" ON "sal_quote"("company_id", "number");
CREATE INDEX "sal_quote_company_id_created_at_idx" ON "sal_quote"("company_id", "created_at" DESC);
CREATE INDEX "sal_quote_company_id_status_idx" ON "sal_quote"("company_id", "status");
CREATE INDEX "sal_quote_company_id_customer_id_idx" ON "sal_quote"("company_id", "customer_id");

CREATE UNIQUE INDEX "sal_quote_line_quote_id_line_no_key" ON "sal_quote_line"("quote_id", "line_no");
CREATE INDEX "sal_quote_line_company_id_quote_id_idx" ON "sal_quote_line"("company_id", "quote_id");

ALTER TABLE "sal_quote_line" ADD CONSTRAINT "sal_quote_line_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "sal_quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
