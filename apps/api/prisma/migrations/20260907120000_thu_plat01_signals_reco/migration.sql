-- THU-PLAT-01: non-AI signals + recommendations

CREATE TYPE "ThuSignalSeverity" AS ENUM ('INFO', 'WARN', 'CRITICAL');
CREATE TYPE "ThuSignalStatus" AS ENUM ('OPEN', 'ACK', 'CLOSED');
CREATE TYPE "ThuRecommendationStatus" AS ENUM ('OPEN', 'IGNORED', 'APPROVED', 'APPLIED', 'REJECTED');

CREATE TABLE IF NOT EXISTS "thu_signal" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "site_id" UUID,
    "type" TEXT NOT NULL,
    "severity" "ThuSignalSeverity" NOT NULL DEFAULT 'INFO',
    "status" "ThuSignalStatus" NOT NULL DEFAULT 'OPEN',
    "source" TEXT NOT NULL,
    "source_event_id" TEXT,
    "source_event_type" TEXT,
    "correlation_id" TEXT NOT NULL,
    "evidence_json" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "thu_signal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "thu_signal_company_id_type_source_event_id_key"
  ON "thu_signal"("company_id", "type", "source_event_id");

CREATE INDEX IF NOT EXISTS "thu_signal_company_id_status_created_at_idx"
  ON "thu_signal"("company_id", "status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "thu_signal_company_id_type_idx"
  ON "thu_signal"("company_id", "type");

CREATE INDEX IF NOT EXISTS "thu_signal_correlation_id_idx"
  ON "thu_signal"("correlation_id");

CREATE TABLE IF NOT EXISTS "thu_recommendation" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "signal_id" UUID,
    "problem" TEXT NOT NULL,
    "evidence_json" JSONB NOT NULL,
    "options_json" JSONB NOT NULL,
    "autonomy_level" INTEGER NOT NULL DEFAULT 2,
    "proposed_action_json" JSONB NOT NULL,
    "status" "ThuRecommendationStatus" NOT NULL DEFAULT 'OPEN',
    "correlation_id" TEXT NOT NULL,
    "decided_by_user_id" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "thu_recommendation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "thu_recommendation_company_id_status_created_at_idx"
  ON "thu_recommendation"("company_id", "status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "thu_recommendation_signal_id_idx"
  ON "thu_recommendation"("signal_id");

CREATE INDEX IF NOT EXISTS "thu_recommendation_correlation_id_idx"
  ON "thu_recommendation"("correlation_id");

ALTER TABLE "thu_recommendation"
  ADD CONSTRAINT "thu_recommendation_signal_id_fkey"
  FOREIGN KEY ("signal_id") REFERENCES "thu_signal"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
