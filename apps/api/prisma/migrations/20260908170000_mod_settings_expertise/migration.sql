-- Expert-validated legal parameters (D091) — no invented rates in seed

CREATE TABLE "set_expertise" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "slot_key" TEXT NOT NULL,
    "value_label" TEXT NOT NULL,
    "rate_bps" INTEGER,
    "amount_milli" INTEGER,
    "law_ref" TEXT NOT NULL,
    "expert_validated_at" TIMESTAMPTZ(6) NOT NULL,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "set_expertise_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "set_expertise_company_id_slot_key_key" ON "set_expertise"("company_id", "slot_key");
CREATE INDEX "set_expertise_company_id_slot_key_idx" ON "set_expertise"("company_id", "slot_key");
