-- THU-08: rule engine sandbox definitions

CREATE TABLE IF NOT EXISTS "thunder_rule_def" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "module_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "event_pattern" TEXT NOT NULL,
    "conditions_json" JSONB NOT NULL,
    "actions_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "thunder_rule_def_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "thunder_rule_def_enabled_priority_idx"
  ON "thunder_rule_def"("enabled", "priority");

CREATE INDEX IF NOT EXISTS "thunder_rule_def_company_id_module_key_idx"
  ON "thunder_rule_def"("company_id", "module_key");

CREATE INDEX IF NOT EXISTS "thunder_rule_def_event_pattern_idx"
  ON "thunder_rule_def"("event_pattern");
