-- CreateTable
CREATE TABLE "lbl_template" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zpl" TEXT NOT NULL,
    "width_mm" INTEGER NOT NULL,
    "height_mm" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lbl_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lbl_print_log" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "lot_id" UUID,
    "data" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "printed_at" TIMESTAMPTZ(6),
    "printer_name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lbl_print_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lbl_template_company_id_active_idx" ON "lbl_template"("company_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "lbl_template_company_id_code_key" ON "lbl_template"("company_id", "code");

-- CreateIndex
CREATE INDEX "lbl_print_log_company_id_created_at_idx" ON "lbl_print_log"("company_id", "created_at" DESC);

