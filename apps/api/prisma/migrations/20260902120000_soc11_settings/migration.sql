-- SOC-11: settings hierarchy (set_def / set_value)

CREATE TYPE "SetLevel" AS ENUM ('SYSTEM', 'COMPANY', 'ROLE', 'USER');

CREATE TABLE "set_def" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value_type" TEXT NOT NULL,
    "default_json" JSONB NOT NULL,
    "description" TEXT,
    "is_pref_only" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "set_def_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "set_def_key_key" ON "set_def"("key");

CREATE TABLE "set_value" (
    "id" UUID NOT NULL,
    "def_key" TEXT NOT NULL,
    "level" "SetLevel" NOT NULL,
    "scope_key" TEXT NOT NULL,
    "company_id" UUID,
    "value_json" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "set_value_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "set_value_def_key_scope_key_key" ON "set_value"("def_key", "scope_key");
CREATE INDEX "set_value_company_id_level_idx" ON "set_value"("company_id", "level");

ALTER TABLE "set_value" ADD CONSTRAINT "set_value_def_key_fkey" FOREIGN KEY ("def_key") REFERENCES "set_def"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
