-- MOD-CUSTOMERS V1a: md_party kernel + cus_customer + cus_contact

CREATE TYPE "MdPartyType" AS ENUM ('CUSTOMER', 'SUPPLIER', 'BOTH');
CREATE TYPE "MdPartyStatus" AS ENUM ('ACTIVE', 'BLOCKED');
CREATE TYPE "CusCustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "md_party" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "type" "MdPartyType" NOT NULL,
    "legal_name" TEXT NOT NULL,
    "tax_id" TEXT,
    "default_lang" TEXT,
    "status" "MdPartyStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "md_party_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "md_party_company_id_created_at_idx" ON "md_party"("company_id", "created_at" DESC);
CREATE INDEX "md_party_company_id_type_status_idx" ON "md_party"("company_id", "type", "status");
CREATE INDEX "md_party_company_id_legal_name_idx" ON "md_party"("company_id", "legal_name");

CREATE TABLE "cus_customer" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "sales_rep" TEXT,
    "payment_terms" TEXT,
    "status" "CusCustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cus_customer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cus_customer_company_id_code_key" ON "cus_customer"("company_id", "code");
CREATE UNIQUE INDEX "cus_customer_company_id_party_id_key" ON "cus_customer"("company_id", "party_id");
CREATE INDEX "cus_customer_company_id_created_at_idx" ON "cus_customer"("company_id", "created_at" DESC);
CREATE INDEX "cus_customer_company_id_status_idx" ON "cus_customer"("company_id", "status");

CREATE TABLE "cus_contact" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "role" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cus_contact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cus_contact_company_id_customer_id_created_at_idx" ON "cus_contact"("company_id", "customer_id", "created_at" DESC);

ALTER TABLE "cus_customer" ADD CONSTRAINT "cus_customer_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "md_party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cus_contact" ADD CONSTRAINT "cus_contact_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "cus_customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
